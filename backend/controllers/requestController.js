import * as notionService from '../services/notionService.js';
import * as slaUtil from '../utils/sla.js';
import { analyzeRequest } from '../services/requestAnalyzer.js';
import { getRobustRequestAnalysis } from '../services/groqService.js';
import { validateAndProcessTransition, logStatusTransition } from '../utils/statusWorkflow.js';
import { processRequestIncidentLinking } from '../services/duplicateDetectionService.js';
import { triggerNotification, EVENTS } from '../services/notificationService.js';
import { processIncomingRequest } from '../services/requestProcessingService.js';

/**
 * POST /api/requests
 * Creates a new request with dynamic Gemini AI request analysis, safety override, department mapping, and fallback.
 */
export async function createRequest(req, res, next) {
  try {
    const { requesterName, requesterEmail, location, description, forceFallback } = req.body;

    const requestData = await processIncomingRequest({
      requesterName,
      requesterEmail,
      location,
      description,
      forceFallback,
      source: 'Web'
    });

    res.status(201).json({
      success: true,
      data: requestData
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
