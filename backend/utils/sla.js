/**
 * SLA thresholds in hours for each priority level.
 */
export const SLA_THRESHOLDS = {
  LOW: 72,
  MEDIUM: 24,
  HIGH: 12,
  CRITICAL: 4
};

/**
 * Get SLA hours based on priority.
 * Default is 24 hours (MEDIUM) if priority is unknown or not set.
 * @param {string} priority 
 * @returns {number}
 */
export function getSlaHours(priority) {
  const normalized = (priority || '').toUpperCase();
  return SLA_THRESHOLDS[normalized] || SLA_THRESHOLDS.MEDIUM;
}

/**
 * Calculate due date/time based on created date and SLA hours.
 * @param {string|Date} createdAt 
 * @param {number} slaHours 
 * @returns {Date}
 */
export function calculateDueAt(createdAt, slaHours) {
  const date = new Date(createdAt);
  date.setHours(date.getHours() + slaHours);
  return date;
}

/**
 * Check if the SLA has been breached.
 * @param {string|Date} dueAt 
 * @returns {boolean}
 */
export function isSlaBreached(dueAt) {
  if (!dueAt) return false;
  return new Date() > new Date(dueAt);
}
