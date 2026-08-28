import { createActionLog } from '../services/notionService.js';

const ALLOWED_TRANSITIONS = {
  'NEW': ['TRIAGED', 'SLA_BREACHED'],
  'TRIAGED': ['ASSIGNED', 'SLA_BREACHED'],
  'ASSIGNED': ['IN_PROGRESS', 'SLA_BREACHED'],
  'IN_PROGRESS': ['WAITING', 'RESOLVED', 'SLA_BREACHED'],
  'WAITING': ['IN_PROGRESS', 'RESOLVED', 'SLA_BREACHED'],
  'SLA_BREACHED': ['IN_PROGRESS', 'ESCALATED'],
  'ESCALATED': ['IN_PROGRESS', 'RESOLVED'],
  'RESOLVED': ['VERIFIED'],
  'VERIFIED': ['CLOSED'],
  'CLOSED': []
};

/**
 * Validates a status transition.
 * Throws a validation error if the transition is disallowed.
 *
 * @param {string} currentStatus - Current ticket status
 * @param {string} nextStatus - Proposed ticket status
 * @returns {boolean} True if allowed
 */
export function validateStatusTransition(currentStatus, nextStatus) {
  const current = (currentStatus || 'NEW').toUpperCase();
  const next = (nextStatus || '').toUpperCase();

  // If the status is not changing, it's always allowed
  if (current === next) {
    return true;
  }

  // Reject transitions if the current status is CLOSED
  if (current === 'CLOSED') {
    const error = new Error('Updates are not allowed for CLOSED requests.');
    error.isValidationError = true;
    error.status = 400;
    throw error;
  }

  const allowed = ALLOWED_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    const error = new Error(`Invalid status transition: '${current}' to '${next}'.`);
    error.isValidationError = true;
    error.status = 400;
    throw error;
  }

  return true;
}

/**
 * Validates status transitions and applies resolution checks and status updates.
 *
 * @param {Object} existingRequest - Current Request object from database
 * @param {Object} updates - Target fields to update
 * @param {string} actor - Performed by username
 * @returns {Promise<Object>} Object containing verified updates to save to Notion
 */
export async function validateAndProcessTransition(existingRequest, updates, actor = 'SYSTEM') {
  const currentStatus = (existingRequest.Status || existingRequest.status || 'NEW').toUpperCase();
  
  // 1. Prevent updates to CLOSED requests
  if (currentStatus === 'CLOSED') {
    const error = new Error('Updates are not allowed for CLOSED requests.');
    error.isValidationError = true;
    error.status = 400;
    throw error;
  }

  const nextStatus = updates.status ? updates.status.toUpperCase() : null;

  // 2. Validate status transition if status is changing
  if (nextStatus && nextStatus !== currentStatus) {
    validateStatusTransition(currentStatus, nextStatus);

    // 3. Resolution rules
    if (nextStatus === 'RESOLVED') {
      const resolutionText = updates.resolution || existingRequest.Resolution || existingRequest.resolution;
      if (!resolutionText || !resolutionText.trim()) {
        const error = new Error('A request cannot move to RESOLVED status without providing meaningful resolution notes.');
        error.isValidationError = true;
        error.status = 400;
        throw error;
      }

      // Add Resolved At timestamp
      updates.resolvedAt = new Date().toISOString();
    }
  }

  return updates;
}

/**
 * Handle custom logging for status transitions.
 *
 * @param {string} requestId - Request ID (e.g. REQ-0001)
 * @param {string} currentStatus - Current status
 * @param {string} nextStatus - Next status
 * @param {string} actor - Performed by username
 */
export async function logStatusTransition(requestId, currentStatus, nextStatus, actor = 'SYSTEM') {
  const current = (currentStatus || 'NEW').toUpperCase();
  const next = (nextStatus || '').toUpperCase();

  if (current === next) return;

  // Create standard STATUS_CHANGED log
  await createActionLog({
    requestId,
    action: 'STATUS_CHANGED',
    reason: `Status changed from '${current}' to '${next}'.`,
    performedBy: actor,
    result: 'SUCCESS'
  });

  // Additional log if status becomes RESOLVED
  if (next === 'RESOLVED') {
    await createActionLog({
      requestId,
      action: 'RESOLVED',
      reason: 'Request marked as RESOLVED successfully.',
      performedBy: actor,
      result: 'SUCCESS'
    });
  }
}
