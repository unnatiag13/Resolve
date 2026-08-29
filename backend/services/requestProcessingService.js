import * as notionService from './notionService.js';
import { getRobustRequestAnalysis } from './groqService.js';
import { processRequestIncidentLinking } from './duplicateDetectionService.js';
import { triggerNotification, EVENTS } from './notificationService.js';

/**
 * Helper to validate email format.
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Centralized Request Processing Service
 * Shared by both Web Form (POST /api/requests) and WhatsApp Webhook (POST /api/whatsapp/webhook).
 *
 * @param {Object} input - Incoming request payload
 * @param {string} [input.source='Web'] - 'Web' | 'WhatsApp' | 'Manual'
 * @param {string} [input.requesterName] - Name of requester
 * @param {string} [input.requesterEmail] - Email of requester (required for Web)
 * @param {string} [input.requesterPhone] - Phone of requester (used for WhatsApp)
 * @param {string} [input.location] - Location (required for Web, optional/inferred for WhatsApp)
 * @param {string} input.description - Description of request (required for all)
 * @param {boolean} [input.forceFallback=false] - Debug flag to force rule-based fallback
 * @returns {Promise<Object>} Normalized created request data
 */
export async function processIncomingRequest(input = {}) {
  const {
    source = 'Web',
    requesterEmail,
    requesterPhone,
    forceFallback = false
  } = input;

  const description = input.description ? String(input.description).trim() : '';

  // 1. Description is universally mandatory
  if (!description) {
    const err = new Error('Description is required.');
    err.isValidationError = true;
    err.status = 400;
    throw err;
  }

  // 2. Channel-specific validation and normalization
  let normalizedName = input.requesterName ? String(input.requesterName).trim() : '';
  let normalizedEmail = requesterEmail ? String(requesterEmail).trim() : null;
  let normalizedPhone = requesterPhone ? String(requesterPhone).trim() : '';
  let normalizedLocation = input.location ? String(input.location).trim() : '';

  if (source.toLowerCase() === 'web') {
    if (!normalizedName) {
      const err = new Error('Requester name is required.');
      err.isValidationError = true;
      err.status = 400;
      throw err;
    }
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      const err = new Error('A valid requester email address is required.');
      err.isValidationError = true;
      err.status = 400;
      throw err;
    }
    if (!normalizedLocation) {
      const err = new Error('Location is required.');
      err.isValidationError = true;
      err.status = 400;
      throw err;
    }
  } else if (source.toLowerCase() === 'whatsapp') {
    // For WhatsApp: Safe fallbacks for missing name / location / email
    if (!normalizedName) {
      normalizedName = normalizedPhone || 'WhatsApp User';
    }
    // Location can remain empty or will be inferred by AI analysis
    normalizedLocation = normalizedLocation || '';
  } else {
    // Default / Manual fallback
    if (!normalizedName) {
      normalizedName = 'Requester';
    }
  }

  console.log(`[Request Processing] Intake from [${source}] by ${normalizedName} (${normalizedEmail || normalizedPhone || 'N/A'}). Description: "${description.substring(0, 50)}..."`);

  // 3. Generate a Request ID (e.g. REQ-0001)
  const requestId = await notionService.getNextRequestId();

  // 4. Robust Request Analysis (Gemini AI -> Safety Override -> Department Mapping -> SLA -> Rule-based Fallback)
  const analysis = await getRobustRequestAnalysis(
    { description, location: normalizedLocation, requesterName: normalizedName },
    Boolean(forceFallback)
  );

  // 5. Run duplicate request detection & incident linking BEFORE storing in Notion
  const linkingResult = await processRequestIncidentLinking({
    category: analysis.category,
    location: normalizedLocation,
    description
  }, null);

  const finalIncidentId = linkingResult.linked ? linkingResult.incidentId : '';

  // 6. Create request in Notion (single write with incidentId already populated)
  const notionRequestData = {
    requestId,
    description,
    requesterName: normalizedName,
    requesterEmail: normalizedEmail,
    requesterPhone: normalizedPhone,
    location: normalizedLocation,
    source: source.toLowerCase() === 'whatsapp' ? 'WhatsApp' : (source.toLowerCase() === 'web' ? 'Web' : source),
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

  // 7. Trigger Request Created notification concurrently
  triggerNotification(EVENTS.REQUEST_CREATED, {
    ...notionRequestData,
    incidentId: finalIncidentId
  }).catch(err => console.warn('[Notification Error]', err.message));

  // 8. Create Action Logs in parallel
  const actionLogs = [
    {
      requestId,
      action: 'REQUEST_CREATED',
      reason: `New request received via ${notionRequestData.source} and created successfully`,
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

  // Dispatch action logs sequentially to ensure reliable Notion recording without ID collisions or rate limit drops
  for (const log of actionLogs) {
    try {
      await notionService.createActionLog(log);
    } catch (err) {
      console.warn('[Action Logs Error]', err.message);
    }
  }

  return {
    id: requestId,
    requestId,
    requesterName: newRequest['Requester Name'] || normalizedName,
    requesterEmail: newRequest['Requester Email'] || normalizedEmail,
    requesterPhone: newRequest['Requester Phone'] || normalizedPhone,
    location: newRequest.Location || normalizedLocation,
    description: newRequest.Description || description,
    source: newRequest.Source || notionRequestData.source,
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
  };
}
