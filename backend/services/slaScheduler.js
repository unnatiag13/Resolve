import { monitorSlaStates } from './slaMonitoringService.js';

let isRunning = false;
let intervalId = null;

/**
 * Execute a single SLA monitoring cycle.
 * Prevents overlapping executions.
 */
export async function runMonitoringCycle() {
  if (isRunning) {
    console.log('[SLA Scheduler] SLA monitoring cycle is already in progress. Skipping this interval.');
    return;
  }

  isRunning = true;
  console.log('[SLA Scheduler] SLA monitoring cycle started');

  try {
    const report = await monitorSlaStates();
    console.log(`[SLA Scheduler] Checking ${report.unresolvedCount} active requests`);
    console.log(`[SLA Scheduler] SLA monitoring cycle completed. Breaches: ${report.processedBreachesThisCycle}, Escalations: ${report.processedEscalationsThisCycle}, Reminders: ${report.triggeredRemindersThisCycle}`);
  } catch (error) {
    console.error('[SLA Scheduler] Error during SLA monitoring cycle:', error.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Initialize and start the SLA monitoring scheduler.
 */
export function startSlaScheduler() {
  const intervalMinutes = Number(process.env.SLA_MONITOR_INTERVAL_MINUTES || 5);
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[SLA Scheduler] Starting SLA scheduler with interval of ${intervalMinutes} minutes.`);

  // Run immediately on startup
  runMonitoringCycle();

  // Schedule subsequent runs
  intervalId = setInterval(runMonitoringCycle, intervalMs);
}

/**
 * Stop the SLA scheduler interval.
 */
export function stopSlaScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[SLA Scheduler] SLA scheduler stopped.');
  }
}
