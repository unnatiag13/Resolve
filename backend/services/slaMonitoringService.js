import { getRequests } from './notionService.js';
import { isSlaBreached } from '../utils/sla.js';

// Unresolved statuses considered active under SLA monitoring
const UNRESOLVED_STATUSES = ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS'];

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

  // If resolved or closed, it's not active under SLA monitoring
  const isUnresolved = UNRESOLVED_STATUSES.includes(statusStr);
  if (!isUnresolved) {
    return {
      status: statusStr,
      state: 'RESOLVED',
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
 * Monitor all unresolved requests from Notion and group them by SLA state.
 *
 * @returns {Promise<Object>} SLA summary report
 */
export async function monitorSlaStates() {
  const requests = await getRequests();
  const now = new Date();

  const summary = {
    checkedAt: now.toISOString(),
    totalChecked: requests.length,
    unresolvedCount: 0,
    normal: [],
    warning: [],
    breached: []
  };

  for (const req of requests) {
    const slaState = calculateRequestSlaState(req, now);

    if (slaState.isUnresolved) {
      summary.unresolvedCount++;
      const payload = {
        id: req['Request ID'] || req['Name'] || req.id,
        description: req['Description'] || '',
        status: slaState.status,
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
