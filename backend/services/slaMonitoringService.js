import { getRequests, updateRequest, createActionLog, getActionLogs } from './notionService.js';
import { isSlaBreached } from '../utils/sla.js';
import { triggerNotification, EVENTS } from './notificationService.js';

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

      // Trigger SLA Breach notification
      await triggerNotification(EVENTS.SLA_BREACHED, req);

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
 * Automatically handle escalations for breached requests.
 * Detects unresolved requests that have breached their SLA, checks if they are already escalated,
 * marks them as escalated (populating Escalated At in Notion), and logs the event.
 *
 * @returns {Promise<Array>} List of requests escalated during this run
 */
export async function processSlaEscalations() {
  const requests = await getRequests();
  const now = new Date();
  const processed = [];

  for (const req of requests) {
    const statusStr = (req['Status'] || req['status'] || '').toUpperCase();
    const dueAtStr = req['Due At'] || req['dueAt'];
    const escalatedAt = req['Escalated At'] || req['escalatedAt'];

    // Skip resolved, verified, or closed requests
    const isTerminal = ['RESOLVED', 'VERIFIED', 'CLOSED'].includes(statusStr);
    if (isTerminal || !dueAtStr) continue;

    // Check if deadline is passed and not already escalated
    const dueAtDate = new Date(dueAtStr);
    if (now > dueAtDate && !escalatedAt) {
      const requestId = req['Request ID'] || req['Name'] || req.id;
      console.log(`[SLA Monitor] Escalating request ${requestId} (deadline passed: ${dueAtStr}).`);

      // 1. Mark as Escalated in Requests Notion database (updates Escalated At timestamp)
      await updateRequest(requestId, { escalatedAt: now.toISOString() });

      // Trigger Escalation notification
      await triggerNotification(EVENTS.ESCALATED, req);

      // 2. Create ESCALATED Action Log
      await createActionLog({
        requestId,
        action: 'ESCALATED',
        reason: `Request breached its SLA and was automatically escalated for higher-level attention. Original status: ${statusStr}.`,
        performedBy: 'SLA_MONITOR',
        result: 'SUCCESS'
      });

      processed.push({
        id: requestId,
        originalStatus: statusStr,
        dueAt: dueAtStr,
        escalatedAt: now.toISOString()
      });
    }
  }

  return processed;
}

/**
 * Scan unresolved warning requests, check if they already received a reminder,
 * and trigger a new pre-SLA reminder Action Log if deduplicated.
 *
 * @returns {Promise<Array>} List of triggered reminder events in this run
 */
export async function processSlaReminders() {
  const requests = await getRequests();
  const allLogs = await getActionLogs();
  const now = new Date();
  const processedReminders = [];

  // Create a fast lookup set of Request IDs that already have a REMINDER_SENT log
  const remindedRequestIds = new Set(
    allLogs
      .filter(log => (log['Action'] || log.action) === 'REMINDER_SENT')
      .map(log => log['Request ID'] || log.requestId || log.Name)
  );

  for (const req of requests) {
    const requestId = req['Request ID'] || req['Name'] || req.id;
    const slaState = calculateRequestSlaState(req, now);

    // Only send reminders for unresolved requests in WARNING state
    if (slaState.isUnresolved && slaState.state === 'WARNING') {
      // Deduplicate: check if a reminder was already logged for this ticket
      if (!remindedRequestIds.has(requestId)) {
        console.log(`[SLA Monitor] SLA warning threshold reached for ${requestId}. Triggering pre-SLA reminder.`);

        // Trigger Pre-SLA Reminder notification
        await triggerNotification(EVENTS.REMINDER, req);

        // Create REMINDER_SENT Action Log in Notion
        await createActionLog({
          requestId,
          action: 'REMINDER_SENT',
          reason: `Request is approaching its SLA deadline with ${slaState.remainingHours} hours remaining (Due At: ${slaState.dueAt}).`,
          performedBy: 'SLA_MONITOR',
          result: 'SUCCESS'
        });

        // Add to tracking set to prevent duplicate alerts in same run
        remindedRequestIds.add(requestId);

        processedReminders.push({
          id: requestId,
          description: req['Description'] || '',
          dueAt: slaState.dueAt,
          remainingHours: slaState.remainingHours
        });
      }
    }
  }

  return processedReminders;
}

/**
 * Monitor all unresolved requests from Notion and group them by SLA state.
 * Triggers breach processing, escalation check, and reminder trigger cycles automatically.
 *
 * @returns {Promise<Object>} SLA summary report
 */
export async function monitorSlaStates() {
  // 1. Process breaches, escalations, and reminders first to ensure databases are updated
  const breachedThisCycle = await processSlaBreaches();
  const escalatedThisCycle = await processSlaEscalations();
  const remindedThisCycle = await processSlaReminders();

  const requests = await getRequests();
  const now = new Date();

  const summary = {
    checkedAt: now.toISOString(),
    totalChecked: requests.length,
    processedBreachesThisCycle: breachedThisCycle.length,
    processedEscalationsThisCycle: escalatedThisCycle.length,
    triggeredRemindersThisCycle: remindedThisCycle.length,
    unresolvedCount: 0,
    normal: [],
    warning: [],
    breached: []
  };

  for (const req of requests) {
    const slaState = calculateRequestSlaState(req, now);

    // Active tickets include unresolved status tickets and breached status tickets
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
        remainingHours: slaState.remainingHours,
        escalatedAt: req['Escalated At'] || req['escalatedAt'] || null
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

/**
 * Generate monitoring analytics overview report.
 *
 * @returns {Promise<Object>} Analytics report
 */
export async function getMonitoringOverview() {
  const requests = await getRequests();
  const now = new Date();

  let activeCount = 0;
  let normalCount = 0;
  let warningCount = 0;
  let breachedCount = 0;
  let escalatedCount = 0;
  let resolvedCount = 0;

  for (const req of requests) {
    const statusStr = (req['Status'] || req['status'] || '').toUpperCase();
    const isTerminal = ['RESOLVED', 'VERIFIED', 'CLOSED'].includes(statusStr);

    if (isTerminal) {
      resolvedCount++;
      continue;
    }

    activeCount++;

    const slaState = calculateRequestSlaState(req, now);
    const escalatedAt = req['Escalated At'] || req['escalatedAt'];

    if (escalatedAt) {
      escalatedCount++;
    }

    if (slaState.state === 'BREACHED') {
      breachedCount++;
    } else if (slaState.state === 'WARNING') {
      warningCount++;
    } else {
      normalCount++;
    }
  }

  const totalChecked = requests.length;
  // SLA Compliance Rate: Percentage of requests that have NOT breached
  const complianceRate = totalChecked > 0 
    ? Number((((totalChecked - breachedCount) / totalChecked) * 100).toFixed(2))
    : 100.00;

  return {
    checkedAt: now.toISOString(),
    totalChecked,
    totalActive: activeCount,
    normal: normalCount,
    warning: warningCount,
    breached: breachedCount,
    escalated: escalatedCount,
    resolved: resolvedCount,
    slaComplianceRate: complianceRate
  };
}

/**
 * Retrieve active requests filtered by their SLA monitoring state.
 *
 * @param {string} state - NORMAL, WARNING, or BREACHED
 * @returns {Promise<Array>} List of requests matching the state
 */
export async function getRequestsBySlaState(state) {
  const requests = await getRequests();
  const now = new Date();
  const targetState = state.toUpperCase();
  const matched = [];

  for (const req of requests) {
    const statusStr = (req['Status'] || req['status'] || '').toUpperCase();
    const isTerminal = ['RESOLVED', 'VERIFIED', 'CLOSED'].includes(statusStr);
    if (isTerminal) continue;

    const slaState = calculateRequestSlaState(req, now);

    if (slaState.state === targetState) {
      matched.push({
        id: req['Request ID'] || req['Name'] || req.id,
        description: req['Description'] || '',
        status: req['Status'] || req['status'],
        priority: req['Priority'] || 'MEDIUM',
        slaHours: Number(req['SLA Hours'] || 24),
        dueAt: slaState.dueAt,
        remainingHours: slaState.remainingHours,
        escalatedAt: req['Escalated At'] || req['escalatedAt'] || null
      });
    }
  }

  return matched;
}
