/**
 * List of serious safety hazard indicators that trigger immediate CRITICAL priority override.
 */
export const SAFETY_HAZARD_KEYWORDS = [
  'fire',
  'smoke',
  'gas leak',
  'electric shock',
  'sparking',
  'spark',
  'exposed wire',
  'burning smell',
  'flooding',
  'major water leakage',
  'immediate danger'
];

/**
 * Helper to match keyword using word boundaries.
 */
function isSafetyMatch(text, keyword) {
  const escaped = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, 'i');
  return regex.test(text);
}

/**
 * Checks description for safety hazards and applies priority override if detected.
 *
 * @param {string} description - The request text
 * @param {string} currentPriority - Initial priority assigned by AI or rules
 * @param {string} currentReason - Initial priority reason
 * @returns {Object} { priority: string, priorityReason: string, isSafetyOverride: boolean, matchedIndicator: string|null }
 */
export function applySafetyOverride(description, currentPriority, currentReason) {
  const text = (description || '').toLowerCase();
  
  const matchedIndicator = SAFETY_HAZARD_KEYWORDS.find(keyword => isSafetyMatch(text, keyword));

  if (matchedIndicator) {
    return {
      priority: 'CRITICAL',
      priorityReason: `[SAFETY OVERRIDE]: High-risk indicator ("${matchedIndicator}") detected in description. Escalated to CRITICAL priority (4h SLA). Original reason: ${currentReason || 'N/A'}`,
      isSafetyOverride: true,
      matchedIndicator
    };
  }

  return {
    priority: currentPriority || 'MEDIUM',
    priorityReason: currentReason || 'Normal priority assignment',
    isSafetyOverride: false,
    matchedIndicator: null
  };
}
