import * as notionService from '../services/notionService.js';
import * as slaUtil from '../utils/sla.js';
import { analyzeRequest } from '../services/requestAnalyzer.js';
import { getRobustRequestAnalysis } from '../services/groqService.js';
import { validateAndProcessTransition, logStatusTransition } from '../utils/statusWorkflow.js';
import { processRequestIncidentLinking } from '../services/duplicateDetectionService.js';
import { triggerNotification, EVENTS } from '../services/notificationService.js';

/**
 * Helper to validate email format.
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * POST /api/requests
 * Creates a new request with dynamic Gemini AI request analysis, safety override, department mapping, and fallback.
 */
export async function createRequest(req, res, next) {
  try {
    const { requesterName, requesterEmail, location, description, forceFallback } = req.body;

    console.log(`[API Server] POST /api/requests received from ${requesterName} (${requesterEmail}). Description: "${description ? description.substring(0, 50) : ''}..."`);

    // 1. Validate the request body
    if (!requesterName || !requesterName.trim()) {
      const err = new Error('Requester name is required.');
      err.isValidationError = true;
      throw err;
    }
    if (!requesterEmail || !requesterEmail.trim() || !isValidEmail(requesterEmail)) {
      const err = new Error('A valid requester email address is required.');
      err.isValidationError = true;
      throw err;
    }
    if (!location || !location.trim()) {
      const err = new Error('Location is required.');
      err.isValidationError = true;
      throw err;
    }
    if (!description || !description.trim()) {
      const err = new Error('Description is required.');
      err.isValidationError = true;
      throw err;
    }

    // 2. Generate a Request ID (e.g. REQ-0001)
    const requestId = await notionService.getNextRequestId();

    // 3. Robust Request Analysis (Gemini AI -> Safety Override -> Department Mapping -> SLA -> Rule-based Fallback)
    const analysis = await getRobustRequestAnalysis({ description, location, requesterName }, Boolean(forceFallback));

    // 4. Run duplicate request detection & incident linking BEFORE storing in Notion
    const linkingResult = await processRequestIncidentLinking({
      category: analysis.category,
      location,
      description
    }, null);

    const finalIncidentId = linkingResult.linked ? linkingResult.incidentId : '';

    // 5. Create request in Notion (single write with incidentId already populated)
    const notionRequestData = {
      requestId,
      description,
      requesterName,
      requesterEmail,
      location,
      source: 'Web',
      intent: analysis.intent,
      category: analysis.category,
      subcategory: analysis.subcategory,
      priority: analysis.priority,
      priorityReason: analysis.priorityReason,
      department: analysis.department,
      status: 'TRIAGED',
      slaHours: analysis.slaHours,
      dueAt: analysis.dueAt,
      aiConfidence: analysis.aiConfidence,
      assignedTo: '',
      incidentId: finalIncidentId,
      resolution: ''
    };

    const newRequest = await notionService.createRequest(notionRequestData);

    // Trigger Request Created notification concurrently
    triggerNotification(EVENTS.REQUEST_CREATED, {
      ...notionRequestData,
      incidentId: finalIncidentId
    }).catch(err => console.warn('[Notification Error]', err.message));

    // 6. Create Action Logs in parallel (non-blocking for fast response)
    const actionLogs = [
      {
        requestId,
        action: 'REQUEST_CREATED',
        reason: 'New request received and created successfully',
        performedBy: 'SYSTEM',
        result: 'SUCCESS'
      },
      {
        requestId,
        action: 'AI_ANALYZED',
        reason: `Request analyzed via ${analysis.analysisSource} and classified as ${analysis.category} / ${analysis.subcategory} successfully`,
        performedBy: 'SYSTEM',
        result: 'SUCCESS'
      },
      {
        requestId,
        action: 'PRIORITY_ASSIGNED',
        reason: `${analysis.priority} priority assigned (${analysis.slaHours}h SLA). Reason: ${analysis.priorityReason}`,
        performedBy: 'SYSTEM',
        result: 'SUCCESS'
      },
      {
        requestId,
        action: 'DEPARTMENT_ASSIGNED',
        reason: `Request assigned to ${analysis.department} department`,
        performedBy: 'SYSTEM',
        result: 'SUCCESS'
      }
    ];

    if (linkingResult.linked) {
      actionLogs.push({
        requestId,
        action: 'AI_ANALYZED',
        reason: `Request identified as a duplicate of ${linkingResult.parentId}. Linked to Incident ID: ${finalIncidentId}.`,
        performedBy: 'SYSTEM',
        result: 'SUCCESS'
      });
    }

    // Dispatch action logs concurrently in a single batch
    await Promise.allSettled(actionLogs.map(log => notionService.createActionLog(log)))
      .catch(err => console.warn('[Action Logs Error]', err.message));

    res.status(201).json({
      success: true,
      data: {
        id: requestId,
        requesterName: newRequest['Requester Name'] || requesterName,
        requesterEmail: newRequest['Requester Email'] || requesterEmail,
        location: newRequest.Location || location,
        description: newRequest.Description || description,
        source: newRequest.Source || 'Web',
        intent: newRequest.Intent || analysis.intent,
        category: newRequest.Category || analysis.category,
        subcategory: newRequest.Subcategory || analysis.subcategory,
        priority: newRequest.Priority || analysis.priority,
        priorityReason: newRequest['Priority Reason'] || analysis.priorityReason,
        department: newRequest.Department || analysis.department,
        status: newRequest.Status || 'TRIAGED',
        slaHours: newRequest['SLA Hours'] || analysis.slaHours,
        dueAt: newRequest['Due At'] || analysis.dueAt,
        aiConfidence: newRequest['AI Confidence'] !== undefined && newRequest['AI Confidence'] !== null ? newRequest['AI Confidence'] : analysis.aiConfidence,
        incidentId: finalIncidentId || newRequest['Incident ID'] || '',
        analysisSource: analysis.analysisSource,
        createdAt: newRequest['Created At'] || new Date().toISOString(),
        updatedAt: newRequest['Updated At'] || new Date().toISOString(),
        notionPageId: newRequest.notionPageId
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/requests
 * Get all requests.
 */
export async function getRequests(req, res, next) {
  try {
    const allRequests = await notionService.getRequests();
    // Apply optional filters
    const { status, priority, incidentId, assignedTo } = req.query;
    let filtered = allRequests;
    if (status) {
      const allowed = ['NEW','TRIAGED','ASSIGNED','IN_PROGRESS','WAITING','SLA_BREACHED','ESCALATED','RESOLVED','VERIFIED','CLOSED'];
      if (!allowed.includes(status.toUpperCase())) {
        return res.status(400).json({ success: false, message: `Invalid status filter. Allowed: ${allowed.join(', ')}` });
      }
      filtered = filtered.filter(r => (r.Status || r.status || '').toUpperCase() === status.toUpperCase());
    }
    if (priority) {
      const allowedPri = ['LOW','MEDIUM','HIGH','URGENT'];
      if (!allowedPri.includes(priority.toUpperCase())) {
        return res.status(400).json({ success: false, message: `Invalid priority filter. Allowed: ${allowedPri.join(', ')}` });
      }
      filtered = filtered.filter(r => (r.Priority || r.priority || '').toUpperCase() === priority.toUpperCase());
    }
    if (incidentId) {
      filtered = filtered.filter(r => (r['Incident ID'] || r.incidentId || '').toString() === incidentId);
    }
    if (assignedTo) {
      filtered = filtered.filter(r => {
        const assignee = r['Assigned To'] || r.assignedTo || '';
        return assignee.toString().toLowerCase() === assignedTo.toLowerCase();
      });
    }
    res.status(200).json({
      success: true,
      count: filtered.length,
      data: filtered
    });
  } catch (error) {
    next(error);
  }
}

export async function getRequestLogs(req, res, next) {
  try {
    const { id } = req.params;
    const logs = await notionService.getActionLogs(id);
    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    console.error('[getRequestLogs Error]:', error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
}

/**
 * GET /api/requests/:id
 * Get request by Request ID (e.g. REQ-0001).
 */
export async function getRequestById(req, res, next) {
  try {
    const { id } = req.params;
    const request = await notionService.getRequest(id);

    if (!request) {
      const err = new Error(`Request with ID ${id} not found.`);
      err.status = 404;
      throw err;
    }

    res.status(200).json({
      success: true,
      data: request
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/requests/:id
 * Updates specific fields of a request and logs actions.
 */
export async function updateRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { status, assignedTo, department, resolution } = req.body;

    // Fetch existing first to compare
    const existing = await notionService.getRequest(id);
    if (!existing) {
      const err = new Error(`Request with ID ${id} not found.`);
      err.status = 404;
      throw err;
    }

    const updates = {};
    if (status !== undefined) updates.status = status;
    if (assignedTo !== undefined) updates.assignedTo = assignedTo;
    if (department !== undefined) updates.department = department;
    if (resolution !== undefined) updates.resolution = resolution;

    const performer = req.body.performedBy || 'SYSTEM';

    // Validate the status transition and process resolution rules
    const verifiedUpdates = await validateAndProcessTransition(existing, updates, performer);

    // Update in Notion
    const updated = await notionService.updateRequest(id, verifiedUpdates);

    // Logging status change action
    if (verifiedUpdates.status !== undefined && verifiedUpdates.status !== (existing.Status || existing.status)) {
      await logStatusTransition(id, existing.Status || existing.status, verifiedUpdates.status, performer);
      
      const nextStatus = verifiedUpdates.status.toUpperCase();
      if (nextStatus === 'RESOLVED') {
        await triggerNotification(EVENTS.REQUEST_RESOLVED, updated);
      } else if (nextStatus === 'VERIFIED') {
        await triggerNotification(EVENTS.REQUEST_VERIFIED, updated);
      } else if (nextStatus === 'CLOSED') {
        await triggerNotification(EVENTS.REQUEST_CLOSED, updated);
      }
    }

    if (verifiedUpdates.assignedTo !== undefined && verifiedUpdates.assignedTo !== (existing['Assigned To'] || existing.assignedTo)) {
      await triggerNotification(EVENTS.REQUEST_ASSIGNED, updated);
    }

    if (department !== undefined && department !== existing.Department) {
      await notionService.createActionLog({
        requestId: id,
        action: 'DEPARTMENT_ASSIGNED',
        reason: `Department re-assigned from '${existing.Department}' to '${department}'.`,
        performedBy: performer,
        result: 'SUCCESS'
      });
    }

    if (assignedTo !== undefined && assignedTo !== existing['Assigned To']) {
      await notionService.createActionLog({
        requestId: id,
        action: 'STATUS_CHANGED',
        reason: `Request assigned to staff member '${assignedTo}'.`,
        performedBy: performer,
        result: 'SUCCESS'
      });
    }

    if (resolution !== undefined && resolution !== existing.Resolution) {
      await notionService.createActionLog({
        requestId: id,
        action: 'RESOLVED',
        reason: `Resolution notes recorded: "${resolution}"`,
        performedBy: performer,
        result: 'SUCCESS'
      });
    }

    res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics/overview
 * Dynamic analytics from the Notion Requests database.
 */
export async function getAnalyticsOverview(req, res, next) {
  try {
    const requests = await notionService.getRequests();

    const overview = {
      total: requests.length,
      byStatus: {},
      byPriority: {},
      byCategory: {},
      slaBreachedCount: 0
    };

    const activeUnresolvedStatuses = ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING', 'ESCALATED', 'SLA_BREACHED'];

    requests.forEach(req => {
      // Group by Status
      const status = req.Status || 'UNKNOWN';
      overview.byStatus[status] = (overview.byStatus[status] || 0) + 1;

      // Group by Priority
      const priority = req.Priority || 'UNKNOWN';
      overview.byPriority[priority] = (overview.byPriority[priority] || 0) + 1;

      // Group by Category
      const category = req.Category || 'UNKNOWN';
      overview.byCategory[category] = (overview.byCategory[category] || 0) + 1;

      // Check SLA breach
      if (req['Due At']) {
        const isBreached = new Date() > new Date(req['Due At']);
        const isUnresolved = activeUnresolvedStatuses.includes(status);
        if (isBreached && isUnresolved) {
          overview.slaBreachedCount++;
        }
      }
    });

    res.status(200).json({
      success: true,
      data: overview
    });
  } catch (error) {
    next(error);
  }
}
