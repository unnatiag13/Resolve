/**
 * ResolveAI Reusable API Service Client
 * Connects frontend components to the ResolveAI backend server.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/**
 * Sanitizes backend or network error messages to prevent exposing internal keys or stack traces.
 *
 * @param {any} err - Error object or string
 * @returns {string} Safe, user-friendly message
 */
function sanitizeErrorMessage(err) {
  if (!err) return 'An unexpected error occurred. Please try again.';

  const rawMsg = typeof err === 'string' ? err : err.message || '';

  // Network connection failures
  if (
    rawMsg.includes('fetch') ||
    rawMsg.includes('ECONNREFUSED') ||
    rawMsg.includes('Failed to fetch') ||
    rawMsg.includes('NetworkError')
  ) {
    return 'Unable to reach the ResolveAI backend server. Please verify that the backend is running on Port 5000.';
  }

  // Strip sensitive terms if present in raw error
  let cleanMsg = rawMsg
    .replace(/ntn_[a-zA-Z0-9_-]+/g, '[REDACTED]')
    .replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED]')
    .replace(/AIza[a-zA-Z0-9_-]+/g, '[REDACTED]')
    .replace(/at\s+[\w\d_./\\:<>-]+\s+\(.*?\)/g, '')
    .trim();

  // If error is overly technical or contains stack traces, provide clean fallback
  if (cleanMsg.length > 200 || cleanMsg.includes('node:internal')) {
    return 'The server encountered an issue processing your request. Please try again.';
  }

  return cleanMsg || 'An error occurred while submitting your request.';
}

/**
 * Submit a new request to the ResolveAI backend.
 *
 * @param {Object} requestData
 * @param {string} requestData.requesterName - Name of the requester
 * @param {string} requestData.requesterEmail - Email of the requester
 * @param {string} requestData.location - Location on campus
 * @param {string} requestData.description - Detailed issue description
 * @returns {Promise<Object>} Backend API response data
 */
export async function createRequest(requestData) {
  const { requesterName, requesterEmail, location, description } = requestData;

  const payload = {
    requesterName: requesterName?.trim(),
    requesterEmail: requesterEmail?.trim(),
    location: location?.trim(),
    description: description?.trim()
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    let resJson;
    try {
      resJson = await response.json();
    } catch {
      throw new Error('Server returned an unreadable response format.');
    }

    if (!response.ok || resJson.success === false) {
      const msg = resJson?.message || `Request failed with status ${response.status}`;
      throw new Error(msg);
    }

    return resJson;
  } catch (error) {
    throw new Error(sanitizeErrorMessage(error));
  }
}

/**
 * Health check helper
 */
export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export default {
  createRequest,
  checkBackendHealth
};
