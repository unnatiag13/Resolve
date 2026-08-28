export const ALLOWED_INTENTS = ['COMPLAINT', 'REQUEST', 'QUERY', 'EMERGENCY'];
export const ALLOWED_CATEGORIES = [
  'MAINTENANCE',
  'ELECTRICAL',
  'PLUMBING',
  'IT',
  'HOSTEL',
  'ACADEMIC',
  'ADMINISTRATION',
  'ACCOUNTS',
  'DOCUMENT',
  'SECURITY',
  'OTHER'
];
export const ALLOWED_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/**
 * Validates a Gemini AI analysis response object strictly.
 *
 * @param {Object} aiResponse - Raw parsed object from Gemini AI
 * @returns {Object} { isValid: boolean, errors: Array<string> }
 */
export function validateAIResponse(aiResponse) {
  const errors = [];

  if (!aiResponse || typeof aiResponse !== 'object' || Array.isArray(aiResponse)) {
    return { isValid: false, errors: ['Response must be a valid non-null object'] };
  }

  // 1. Validate intent
  if (!aiResponse.intent || typeof aiResponse.intent !== 'string' || !ALLOWED_INTENTS.includes(aiResponse.intent.toUpperCase())) {
    errors.push(`Invalid or unsupported intent: "${aiResponse.intent}". Must be one of: ${ALLOWED_INTENTS.join(', ')}`);
  }

  // 2. Validate category
  if (!aiResponse.category || typeof aiResponse.category !== 'string' || !ALLOWED_CATEGORIES.includes(aiResponse.category.toUpperCase())) {
    errors.push(`Invalid or unsupported category: "${aiResponse.category}". Must be one of: ${ALLOWED_CATEGORIES.join(', ')}`);
  }

  // 3. Validate subcategory
  if (!aiResponse.subcategory || typeof aiResponse.subcategory !== 'string' || !aiResponse.subcategory.trim()) {
    errors.push('Subcategory must be a non-empty string');
  }

  // 4. Validate priority
  if (!aiResponse.priority || typeof aiResponse.priority !== 'string' || !ALLOWED_PRIORITIES.includes(aiResponse.priority.toUpperCase())) {
    errors.push(`Invalid or unsupported priority: "${aiResponse.priority}". Must be one of: ${ALLOWED_PRIORITIES.join(', ')}`);
  }

  // 5. Validate priorityReason
  if (!aiResponse.priorityReason || typeof aiResponse.priorityReason !== 'string' || !aiResponse.priorityReason.trim()) {
    errors.push('Priority reason must be a non-empty string');
  }

  // 6. Validate aiConfidence
  if (typeof aiResponse.aiConfidence !== 'number' || isNaN(aiResponse.aiConfidence) || aiResponse.aiConfidence < 0 || aiResponse.aiConfidence > 1) {
    errors.push(`aiConfidence must be a number between 0 and 1, received: ${aiResponse.aiConfidence}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
