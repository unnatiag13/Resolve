/**
 * Gemini AI Service (Placeholder for Phase 2)
 * This service will interface with the Gemini API to analyze, classify, and extract details from requests.
 */

export async function analyzeRequest(description) {
  console.warn('Gemini Service called in Phase 1 mock mode.');
  // Return structure that matches future Gemini classification payload
  return {
    category: 'PLUMBING',
    priority: 'HIGH',
    department: 'Maintenance',
    slaHours: 12,
    priorityReason: 'Water outages in hostels are treated as high priority due to immediate sanitation needs.',
    aiConfidence: 0.95,
    intent: 'COMPLAINT',
    subcategory: 'Water Supply'
  };
}
