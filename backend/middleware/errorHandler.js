/**
 * Centralized error handling middleware.
 * Formats errors and prevents leaking internal details/stack traces to the client.
 */
export default function errorHandler(err, req, res, next) {
  console.error('API Error:', err.message || err);

  // Default error status and message
  let statusCode = 500;
  let message = 'An unexpected error occurred. Please try again later.';

  // Handle known/custom error types or check error messages
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = `Bad Request: Invalid JSON payload. Details: ${err.message}`;
  } else if (err.message && err.message.includes('Missing Notion configuration variables')) {
    statusCode = 500;
    message = 'Server configuration error: Notion database configuration is missing.';
  } else if (err.message && err.message.includes('Notion database operation failed')) {
    statusCode = 502; // Bad Gateway / downstream error
    message = 'Failed to save data to the Notion database. Please verify your Notion connection.';
  } else if (err.message && err.message.includes('Notion database query failed')) {
    statusCode = 502;
    message = 'Failed to fetch data from the Notion database. Please verify your Notion connection.';
  } else if (err.message && err.message.includes('not found')) {
    statusCode = 404;
    message = err.message;
  } else if (err.name === 'APIResponseError' || err.name === 'APIRequestError' || (err.code && err.code.startsWith('notion_'))) {
    // If Notion API client throws an error
    statusCode = err.status || err.statusCode || 502;
    message = `Notion integration error: ${err.message}`;
  } else if (err.statusCode) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err.status) {
    statusCode = err.status;
    message = err.message;
  } else if (err.isValidationError) {
    statusCode = 400;
    message = err.message;
  }

  res.status(statusCode).json({
    success: false,
    message: message
  });
}
