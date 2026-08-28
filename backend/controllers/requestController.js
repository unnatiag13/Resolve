import * as notionService from '../services/notionService.js';
import * as slaUtil from '../utils/sla.js';
import { analyzeRequest } from '../services/requestAnalyzer.js';
import { getRobustRequestAnalysis } from '../services/groqService.js';
import { validateAndProcessTransition, logStatusTransition } from '../utils/statusWorkflow.js';
import { processRequestIncidentLinking } from '../services/duplicateDetectionService.js';

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

    // 4. Create request in Notion
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
      incidentId: '',
      resolution: ''
    };

    const newRequest = await notionService.createRequest(notionRequestData);

    // Run duplicate request detection & incident linking
    const linkingResult = await processRequestIncidentLinking(requestId, {
      category: analysis.category,
      location,
      description
    });

    const finalIncidentId = linkingResult.linked ? linkingResult.incidentId : '';

    // 5. Create action log entries in Notion Action Logs DB only
    await notionService.createActionLog({
      requestId,
      action: 'REQUEST_CREATED',
      reason: 'New request received and created successfully',
      performedBy: 'SYSTEM',
      result: 'SUCCESS'
    });

    await notionService.createActionLog({
      requestId,
      action: 'AI_ANALYZED',
      reason: `Request analyzed via ${analysis.analysisSource} and classified as ${analysis.category} / ${analysis.subcategory} successfully`,
      performedBy: 'SYSTEM',
      result: 'SUCCESS'
    });

    await notionService.createActionLog({
      requestId,
      action: 'PRIORITY_ASSIGNED',
      reason: `${analysis.priority} priority assigned (${analysis.slaHours}h SLA). Reason: ${analysis.priorityReason}`,
      performedBy: 'SYSTEM',
      result: 'SUCCESS'
    });

    await notionService.createActionLog({
      requestId,
      action: 'DEPARTMENT_ASSIGNED',
      reason: `Request assigned to ${analysis.department} department`,
      performedBy: 'SYSTEM',
      result: 'SUCCESS'
    });

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
    const requests = await notionService.getRequests();
    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    next(error);
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
