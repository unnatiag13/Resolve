import * as notionService from '../services/notionService.js';
import * as slaUtil from '../utils/sla.js';
import { analyzeRequest } from '../services/requestAnalyzer.js';

/**
 * Helper to validate email format.
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * POST /api/requests
 * Creates a new request with dynamic rule-based AI request analysis.
 */
export async function createRequest(req, res, next) {
  try {
    const { requesterName, requesterEmail, location, description } = req.body;

    // 1. Validate the request body
    if (!requesterName || !requesterName.trim()) {
      const err = new Error('Requester name is required.');
      err.isValidationError = true;
      throw err;
    }
    if (!requesterEmail || !requesterEmail.trim() || !isValidEmail(requesterEmail)) {
      const err = new Error('A valid requester email is required.');
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

    // 3. Dynamic Rule-based Request Analysis
    const analysis = analyzeRequest(description);

    const createdAt = new Date();
    const dueAt = slaUtil.calculateDueAt(createdAt, analysis.slaHours);

    // 4. Create request in Notion
    const notionRequestData = {
      requestId,
      description,
      requesterName,
      requesterEmail,
      location,
      source: 'Web', // Default for web API
      intent: analysis.intent,
      category: analysis.category,
      subcategory: analysis.subcategory,
      priority: analysis.priority,
      priorityReason: analysis.priorityReason,
      department: analysis.department,
      status: analysis.status,
      slaHours: analysis.slaHours,
      dueAt,
      aiConfidence: analysis.aiConfidence,
      assignedTo: '',
      incidentId: '',
      resolution: ''
    };

    const newRequest = await notionService.createRequest(notionRequestData);

    // 5. Create action log entries
    await notionService.createActionLog({
      requestId,
      action: 'REQUEST_CREATED',
      reason: 'Request submitted successfully through the web channel.',
      performedBy: 'SYSTEM',
      result: 'SUCCESS'
    });

    await notionService.createActionLog({
      requestId,
      action: 'AI_ANALYZED',
      reason: `Rule-based AI analyzed intent as '${analysis.intent}', category as '${analysis.category}' and subcategory as '${analysis.subcategory}' (Confidence: ${analysis.aiConfidence}).`,
      performedBy: 'SYSTEM',
      result: 'SUCCESS'
    });

    await notionService.createActionLog({
      requestId,
      action: 'PRIORITY_ASSIGNED',
      reason: `Priority set to '${analysis.priority}' with SLA threshold of ${analysis.slaHours} hours. Reason: ${analysis.priorityReason}`,
      performedBy: 'SYSTEM',
      result: 'SUCCESS'
    });

    await notionService.createActionLog({
      requestId,
      action: 'DEPARTMENT_ASSIGNED',
      reason: `Automatically routed and assigned to department '${analysis.department}'.`,
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
        status: newRequest.Status || analysis.status,
        slaHours: newRequest['SLA Hours'] || analysis.slaHours,
        dueAt: newRequest['Due At'] || dueAt,
        aiConfidence: newRequest['AI Confidence'] !== undefined && newRequest['AI Confidence'] !== null ? newRequest['AI Confidence'] : analysis.aiConfidence,
        createdAt: newRequest['Created At'] || createdAt,
        updatedAt: newRequest['Updated At'] || createdAt,
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

    // Update in Notion
    const updated = await notionService.updateRequest(id, updates);

    // Logging actions based on what changed
    const performer = req.body.performedBy || 'SYSTEM';

    if (status !== undefined && status !== existing.Status) {
      let actionType = 'STATUS_CHANGED';
      if (status === 'RESOLVED') actionType = 'RESOLVED';
      if (status === 'CLOSED') actionType = 'CLOSED';
      if (status === 'ESCALATED') actionType = 'ESCALATED';

      await notionService.createActionLog({
        requestId: id,
        action: actionType,
        reason: `Status changed from '${existing.Status}' to '${status}'.`,
        performedBy: performer,
        result: 'SUCCESS'
      });
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
