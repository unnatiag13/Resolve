import { getRequests, updateRequest, createActionLog } from './notionService.js';
import { isSlaBreached } from '../utils/sla.js';

// Unresolved statuses considered active under SLA monitoring
const UNRESOLVED_STATUSES = ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS'];
const TERMINAL_STATUSES = ['RESOLVED', 'VERIFIED', 'CLOSED', 'SLA_BREACHED'];

/**
 * Reusable function to calculate the SLA state of a single request.
 *
 * @param {Object} request - Notion request object
 * @param {Date} [now] - Current time override for testing
 * @returns {Object} SLA status details
 */
export function calculateRequestSlaState(request, now = new Date()) {
  const dueAtStr = request['Due At'] || request['dueAt'];
  const statusStr = (request['Status'] || request['status'] || '').toUpperCase();
  const slaHours = Number(request['SLA Hours'] || request['slaHours'] || 24);

  // If already resolved, closed, verified, or breached, it's not active under SLA monitoring
  const isUnresolved = UNRESOLVED_STATUSES.includes(statusStr);
  if (!isUnresolved) {
    return {
      status: statusStr,
      state: statusStr === 'SLA_BREACHED' ? 'BREACHED' : 'RESOLVED',
      remainingHours: 0,
      dueAt: dueAtStr,
      isUnresolved: false
    };
  }

  if (!dueAtStr) {
    return {
      status: statusStr,
      state: 'NORMAL',
      remainingHours: 0,
      dueAt: null,
      isUnresolved: true
    };
  }

  const dueAtDate = new Date(dueAtStr);
  const diffMs = dueAtDate.getTime() - now.getTime();
  const remainingHours = diffMs / (1000 * 60 * 60);

  let state = 'NORMAL';

  if (diffMs <= 0) {
    state = 'BREACHED';
  } else {
    // WARNING trigger: remaining time is <= 3 hours OR <= 25% of the total SLA hours
    const warningThresholdHours = Math.max(3, slaHours * 0.25);
    if (remainingHours <= warningThresholdHours) {
      state = 'WARNING';
    }
  }

  return {
    status: statusStr,
    state,
    remainingHours: Number(remainingHours.toFixed(2)),
    dueAt: dueAtStr,
    isUnresolved: true
  };
}

/**
 * Automatically handle breaches: detect past-due unresolved tickets,
 * mark them SLA_BREACHED in Notion, and create logs.
 *
 * @returns {Promise<Array>} List of requests updated during this run
 */
export async function processSlaBreaches() {
  const requests = await getRequests();
  const now = new Date();
  const processed = [];

  for (const req of requests) {
    const statusStr = (req['Status'] || req['status'] || '').toUpperCase();
    const dueAtStr = req['Due At'] || req['dueAt'];

    // Only process if status is unresolved and not already handled
    const isTerminal = TERMINAL_STATUSES.includes(statusStr);
    if (isTerminal || !dueAtStr) continue;

    const dueAtDate = new Date(dueAtStr);
    if (now > dueAtDate) {
      const requestId = req['Request ID'] || req['Name'] || req.id;
      console.log(`[SLA Monitor] SLA breach detected for ${requestId}. Updating status to SLA_BREACHED.`);

      // 1. Update status to SLA_BREACHED in Notion database
      await updateRequest(requestId, { status: 'SLA_BREACHED' });

      // 2. Create status change Action Log
      await createActionLog({
        requestId,
        action: 'STATUS_CHANGED',
        reason: `Request status changed to SLA_BREACHED because the SLA deadline passed (Due At: ${dueAtStr}).`,
        performedBy: 'SLA_MONITOR',
        result: 'SUCCESS'
      });

      // 3. Create SLA breach Action Log
      await createActionLog({
        requestId,
        action: 'SLA_BREACHED',
        reason: `SLA breach recorded. Request missed the deadline (SLA Hours: ${req['SLA Hours'] || 24}h).`,
        performedBy: 'SLA_MONITOR',
        result: 'SUCCESS'
      });

      processed.push({
        id: requestId,
        description: req['Description'] || '',
        dueAt: dueAtStr,
        originalStatus: statusStr
      });
    }
  }

  return processed;
}

/**
 * Monitor all unresolved requests from Notion and group them by SLA state.
 * Triggers breach processing first to handle state transitions automatically.
 *
 * @returns {Promise<Object>} SLA summary report
 */
export async function monitorSlaStates() {
  // Automatically process breaches first to maintain data consistency
  const breachedThisCycle = await processSlaBreaches();

  const requests = await getRequests();
  const now = new Date();

  const summary = {
    checkedAt: now.toISOString(),
    totalChecked: requests.length,
    processedBreachesThisCycle: breachedThisCycle.length,
    unresolvedCount: 0,
    normal: [],
    warning: [],
    breached: []
  };

  for (const req of requests) {
    const slaState = calculateRequestSlaState(req, now);

    // If it is unresolved, or if it is already breached (which is a state we want to report)
    // Note: SLA_BREACHED status tickets will report as BREACHED state under active alerts
    const isUnresolvedOrBreached = slaState.isUnresolved || req['Status'] === 'SLA_BREACHED' || req['status'] === 'SLA_BREACHED';

    if (isUnresolvedOrBreached) {
      summary.unresolvedCount++;
      const payload = {
        id: req['Request ID'] || req['Name'] || req.id,
        description: req['Description'] || '',
        status: req['Status'] || req['status'],
        priority: req['Priority'] || 'MEDIUM',
        slaHours: Number(req['SLA Hours'] || 24),
        dueAt: slaState.dueAt,
        remainingHours: slaState.remainingHours
      };

      if (slaState.state === 'BREACHED') {
        summary.breached.push(payload);
      } else if (slaState.state === 'WARNING') {
        summary.warning.push(payload);
      } else {
        summary.normal.push(payload);
      }
    }
  }

  return summary;
}
