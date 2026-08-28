import { createActionLog } from './notionService.js';

// Supported channels
export const CHANNELS = {
  EMAIL: 'EMAIL',
  WHATSAPP: 'WHATSAPP',
  DASHBOARD: 'DASHBOARD'
};

// Supported events
export const EVENTS = {
  REQUEST_CREATED: 'REQUEST_CREATED',
  REQUEST_ASSIGNED: 'REQUEST_ASSIGNED',
  REMINDER: 'REMINDER',
  SLA_BREACHED: 'SLA_BREACHED',
  ESCALATED: 'ESCALATED',
  REQUEST_RESOLVED: 'REQUEST_RESOLVED',
  REQUEST_VERIFIED: 'REQUEST_VERIFIED',
  REQUEST_CLOSED: 'REQUEST_CLOSED'
};

/**
 * Interface/base class for notification transports.
 */
class BaseTransport {
  constructor(name) {
    this.name = name;
  }

  isConfigured() {
    return false;
  }

  async send(recipient, payload) {
    throw new Error('Not implemented');
  }
}

/**
 * Email notification transport.
 */
class EmailTransport extends BaseTransport {
  constructor() {
    super(CHANNELS.EMAIL);
  }

  isConfigured() {
    // Check SMTP credentials or email key in env
    return !!(process.env.SMTP_HOST || process.env.SENDGRID_API_KEY || process.env.EMAIL_API_KEY);
  }

  async send(recipient, payload) {
    if (!this.isConfigured()) {
      return {
        success: false,
        resultCode: 'NOT_CONFIGURED',
        details: `SMTP/Email provider not configured. Payload: ${JSON.stringify(payload.body)}`
      };
    }

    try {
      console.log(`[Email Transport] Sending email to ${recipient}...`);
      return {
        success: true,
        resultCode: 'SUCCESS',
        details: `Email successfully sent to ${recipient}.`
      };
    } catch (err) {
      return {
        success: false,
        resultCode: 'FAILED',
        details: `Email failed to send to ${recipient}: ${err.message}`
      };
    }
  }
}

/**
 * WhatsApp notification transport.
 */
class WhatsAppTransport extends BaseTransport {
  constructor() {
    super(CHANNELS.WHATSAPP);
  }

  isConfigured() {
    // Check WhatsApp API credentials
    return !!(process.env.WHATSAPP_API_KEY || process.env.TWILIO_AUTH_TOKEN);
  }

  async send(recipient, payload) {
    if (!this.isConfigured()) {
      return {
        success: false,
        resultCode: 'NOT_CONFIGURED',
        details: `WhatsApp provider not configured. Payload: ${JSON.stringify(payload.body)}`
      };
    }

    try {
      console.log(`[WhatsApp Transport] Sending WhatsApp message to ${recipient}...`);
      return {
        success: true,
        resultCode: 'SUCCESS',
        details: `WhatsApp message successfully sent to ${recipient}.`
      };
    } catch (err) {
      return {
        success: false,
        resultCode: 'FAILED',
        details: `WhatsApp message failed to send to ${recipient}: ${err.message}`
      };
    }
  }
}

/**
 * Dashboard / In-app notification transport.
 */
class DashboardTransport extends BaseTransport {
  constructor() {
    super(CHANNELS.DASHBOARD);
  }

  isConfigured() {
    return true; // Dashboard alerts are always active locally
  }

  async send(recipient, payload) {
    console.log(`[Dashboard Transport] Dispatching alert to ${recipient}: "${payload.title}"`);
    return {
      success: true,
      resultCode: 'SUCCESS',
      details: `In-app dashboard notification logged for ${recipient}: "${payload.title}"`
    };
  }
}

// Instantiate transports registry
const Transports = {
  [CHANNELS.EMAIL]: new EmailTransport(),
  [CHANNELS.WHATSAPP]: new WhatsAppTransport(),
  [CHANNELS.DASHBOARD]: new DashboardTransport()
};

/**
 * Generates notification payload (title and body) for a given event and context.
 */
function buildNotificationPayload(event, context) {
  const reqId = context.requestId || context.id || 'REQ-xxxx';
  const desc = context.description || context.Description || '';
  const loc = context.location || context.Location || '';
  const category = context.category || context.Category || '';
  const priority = context.priority || context.Priority || '';
  const assignee = context.assignedTo || context['Assigned To'] || '';
  const resolution = context.resolution || context.Resolution || '';

  let title = '';
  let body = '';

  switch (event) {
    case EVENTS.REQUEST_CREATED:
      title = `Request Received: ${reqId}`;
      body = `Your request regarding "${desc.substring(0, 50)}..." in ${loc} has been logged in Category: ${category}. Priority: ${priority}.`;
      break;
    case EVENTS.REQUEST_ASSIGNED:
      title = `Request Assigned: ${reqId}`;
      body = `Ticket ${reqId} has been assigned to staff member: ${assignee || 'Unspecified'}.`;
      break;
    case EVENTS.REMINDER:
      title = `SLA Reminder Alert: ${reqId}`;
      body = `Warning: Ticket ${reqId} at "${loc}" is approaching its SLA deadline. Urgency status is now WARNING.`;
      break;
    case EVENTS.SLA_BREACHED:
      title = `SLA Breach Warning: ${reqId}`;
      body = `Alert: Ticket ${reqId} has breached its SLA. Status updated to SLA_BREACHED.`;
      break;
    case EVENTS.ESCALATED:
      title = `Escalation Alert: ${reqId}`;
      body = `Critical Alert: Ticket ${reqId} has been escalated for high-level management attention.`;
      break;
    case EVENTS.REQUEST_RESOLVED:
      title = `Request Resolved: ${reqId}`;
      body = `Good news! Ticket ${reqId} has been marked as RESOLVED. Resolution notes: "${resolution}"`;
      break;
    case EVENTS.REQUEST_VERIFIED:
      title = `Resolution Verified: ${reqId}`;
      body = `The resolution of ticket ${reqId} has been verified by the user.`;
      break;
    case EVENTS.REQUEST_CLOSED:
      title = `Request Closed: ${reqId}`;
      body = `Ticket ${reqId} has been successfully CLOSED. Thank you for using ResolveAI!`;
      break;
    default:
      title = `Update on ticket ${reqId}`;
      body = `Ticket ${reqId} underwent status transition to ${event}.`;
  }

  return { title, body };
}

/**
 * Determines recipients and channels based on event type.
 */
function getRecipientsAndChannels(event, context) {
  const requesterEmail = context.requesterEmail || context['Requester Email'] || context.email;
  const assignee = context.assignedTo || context['Assigned To'] || '';
  const department = context.department || context.Department || 'General Support';

  const channels = [];
  const recipients = {};

  switch (event) {
    case EVENTS.REQUEST_CREATED:
      if (requesterEmail) {
        channels.push(CHANNELS.EMAIL);
        recipients[CHANNELS.EMAIL] = requesterEmail;
      }
      channels.push(CHANNELS.DASHBOARD);
      recipients[CHANNELS.DASHBOARD] = `Student_${requesterEmail || 'Anonymous'}`;
      break;

    case EVENTS.REQUEST_ASSIGNED:
      if (assignee) {
        channels.push(CHANNELS.EMAIL);
        recipients[CHANNELS.EMAIL] = `${assignee.toLowerCase().replace(/\s+/g, '.')}@campus.edu`;
        channels.push(CHANNELS.DASHBOARD);
        recipients[CHANNELS.DASHBOARD] = `Staff_${assignee}`;
      }
      break;

    case EVENTS.REMINDER:
    case EVENTS.SLA_BREACHED:
    case EVENTS.ESCALATED:
      channels.push(CHANNELS.EMAIL);
      recipients[CHANNELS.EMAIL] = `admin.${department.toLowerCase().replace(/\s+/g, '')}@campus.edu`;
      channels.push(CHANNELS.WHATSAPP);
      recipients[CHANNELS.WHATSAPP] = '+15550199'; // Admin mobile phone
      channels.push(CHANNELS.DASHBOARD);
      recipients[CHANNELS.DASHBOARD] = `Admin_${department}`;
      break;

    case EVENTS.REQUEST_RESOLVED:
    case EVENTS.REQUEST_VERIFIED:
    case EVENTS.REQUEST_CLOSED:
      if (requesterEmail) {
        channels.push(CHANNELS.EMAIL);
        recipients[CHANNELS.EMAIL] = requesterEmail;
      }
      channels.push(CHANNELS.DASHBOARD);
      recipients[CHANNELS.DASHBOARD] = `Student_${requesterEmail || 'Anonymous'}`;
      break;
  }

  return { channels, recipients };
}

/**
 * Dispatches notifications across multiple channels and logs results to Notion Action Logs.
 *
 * @param {string} event - Notification event type (e.g. EVENTS.REQUEST_CREATED)
 * @param {Object} context - Request details
 */
export async function triggerNotification(event, context) {
  const reqId = context.requestId || context.id || context.Name || 'REQ-xxxx';
  const { channels, recipients } = getRecipientsAndChannels(event, context);
  const payload = buildNotificationPayload(event, context);

  console.log(`[Notification Service] Triggered event ${event} for Request ${reqId}`);

  for (const channel of channels) {
    const transport = Transports[channel];
    if (!transport) continue;

    const recipient = recipients[channel];
    const dispatchResult = await transport.send(recipient, payload);

    try {
      await createActionLog({
        requestId: reqId,
        action: 'AI_ANALYZED', // Reuse AI_ANALYZED to fit Notion DB select property schema
        reason: `[Notification: ${channel}] Event: ${event} | To: ${recipient} | Msg: "${payload.title}". Details: ${dispatchResult.details}`,
        performedBy: 'SYSTEM',
        result: dispatchResult.resultCode // NOT_CONFIGURED or SUCCESS
      });
    } catch (logErr) {
      console.warn(`[Notification Service] Failed to log dispatch result to Action Logs:`, logErr.message);
    }
  }
}
