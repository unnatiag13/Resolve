/**
 * ResolveAI WhatsApp Integration Service (Phase 6.1)
 *
 * Provides:
 * - Multi-provider payload normalization (Evolution API, Meta/Cloud API, Twilio, Direct Payload)
 * - Safe event filtering (ignoring bot echo, status receipts, group messages, non-text)
 * - In-memory sliding window deduplication to prevent webhook loops & repeated processing
 * - Dynamic WhatsApp confirmation message formatting & outbound dispatch
 */

// In-Memory Webhook Deduplication Cache (15-minute TTL)
const processedEventsCache = new Map();
const DEDUPLICATION_TTL_MS = 15 * 60 * 1000;

/**
 * Processes and inspects an incoming Evolution API webhook payload safely.
 * Extracts safe summary info (event, instance, hasMessageData, messageDetails)
 * without exposing secrets, credentials, or full sensitive payload data.
 *
 * @param {Object} payload - Raw JSON payload from Evolution API
 * @returns {Object} Safe parsed summary
 */
export function processEvolutionWebhook(payload = {}) {
  if (!payload || typeof payload !== 'object') {
    return {
      isValid: false,
      event: 'UNKNOWN',
      instance: 'UNKNOWN',
      hasMessageData: false,
      summary: 'Empty or non-JSON webhook payload'
    };
  }

  const event = payload.event || payload.type || 'UNKNOWN';
  const instance = payload.instance || payload.instanceName || payload.data?.instance || 'resolveai';

  let hasMessageData = false;
  let messageDetails = null;

  if (payload.data && typeof payload.data === 'object') {
    const data = payload.data;
    const key = data.key || {};
    const msgObj = data.message || {};

    const text = (
      msgObj.conversation ||
      msgObj.extendedTextMessage?.text ||
      msgObj.imageMessage?.caption ||
      msgObj.videoMessage?.caption ||
      ''
    ).trim();

    const rawSender = (key.remoteJid || '').replace(/@.*$/, '');
    const fromMe = Boolean(key.fromMe);
    const pushName = data.pushName || null;

    if (text || data.messageType || Object.keys(msgObj).length > 0) {
      hasMessageData = true;
      // Mask sender phone for privacy / log safety
      const maskedSender = rawSender.length > 4
        ? `${rawSender.substring(0, 3)}****${rawSender.substring(rawSender.length - 2)}`
        : (rawSender || 'Unknown');

      messageDetails = {
        fromMe,
        sender: maskedSender,
        pushName: pushName || undefined,
        messageType: data.messageType || (msgObj.conversation ? 'conversation' : 'other'),
        hasText: Boolean(text),
        textSnippet: text ? (text.length > 60 ? `${text.substring(0, 60)}...` : text) : undefined
      };
    }
  }

  return {
    isValid: true,
    event,
    instance,
    hasMessageData,
    messageDetails
  };
}


/**
 * Periodically purge stale deduplication records.
 */
function cleanStaleEvents() {
  const now = Date.now();
  for (const [key, timestamp] of processedEventsCache.entries()) {
    if (now - timestamp > DEDUPLICATION_TTL_MS) {
      processedEventsCache.delete(key);
    }
  }
}

/**
 * Checks and records event ID for deduplication.
 *
 * @param {string} eventId - Unique event / message identifier
 * @returns {boolean} True if event was already processed (duplicate), false if new
 */
export function isDuplicateEvent(eventId) {
  if (!eventId) return false;
  cleanStaleEvents();

  if (processedEventsCache.has(eventId)) {
    return true;
  }

  processedEventsCache.set(eventId, Date.now());
  return false;
}

/**
 * Clears the deduplication cache (useful for testing).
 */
export function clearDeduplicationCache() {
  processedEventsCache.clear();
}

/**
 * Normalizes any incoming WhatsApp webhook payload into a standard request object.
 *
 * @param {Object} payload - Raw incoming webhook body
 * @returns {Object} { shouldProcess: boolean, reason?: string, data?: { source: 'WhatsApp', requesterName, requesterPhone, description, location, messageId } }
 */
export function normalizeIncomingPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') {
    return { shouldProcess: false, reason: 'Invalid or empty webhook payload' };
  }

  // 1. Direct / Normalized Test Payload (e.g. from internal simulator or direct JSON)
  if (payload.description || payload.message) {
    const description = (payload.description || payload.message || '').trim();
    if (!description) {
      return { shouldProcess: false, reason: 'Empty message text' };
    }

    const requesterPhone = (payload.requesterPhone || payload.phone || payload.from || '').trim();
    const requesterName = (payload.requesterName || payload.name || payload.sender || '').trim() || (requesterPhone || 'WhatsApp User');
    const location = (payload.location || '').trim();
    const messageId = payload.messageId || payload.id || `WA-DIRECT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    return {
      shouldProcess: true,
      data: {
        source: 'WhatsApp',
        requesterName,
        requesterPhone,
        description,
        location,
        messageId
      }
    };
  }

  // 2. Evolution API format
  // Example: { event: "messages.upsert" or "MESSAGES_UPSERT", data: { key: { remoteJid, fromMe, id }, pushName, message: { conversation } } }
  if (payload.event || payload.data?.key) {
    const rawEvent = (payload.event || payload.type || '').trim();
    const eventType = rawEvent.toLowerCase().replace(/_/g, '.');

    // Only process messages.upsert events
    if (rawEvent && eventType !== 'messages.upsert') {
      return { shouldProcess: false, reason: `Ignored event type: ${rawEvent}` };
    }

    const data = payload.data || {};
    const key = data.key || {};

    // Ignore bot's own outgoing messages to prevent infinite loops
    if (key.fromMe) {
      return { shouldProcess: false, reason: "Ignored message sent by the ResolveAI WhatsApp account itself (self-message)" };
    }

    const remoteJid = key.remoteJid || '';

    // Ignore status broadcasts and group messages unless explicitly supported
    if (remoteJid.includes('status@broadcast') || remoteJid.includes('@g.us')) {
      return { shouldProcess: false, reason: 'Ignored group message or status broadcast' };
    }

    // Extract text from conversation, extendedTextMessage, or media captions
    const msgObj = data.message || {};
    const text = (
      msgObj.conversation ||
      msgObj.extendedTextMessage?.text ||
      msgObj.imageMessage?.caption ||
      msgObj.videoMessage?.caption ||
      msgObj.documentMessage?.caption ||
      ''
    ).trim();

    if (!text) {
      return { shouldProcess: false, reason: 'Unsupported non-text message or empty text' };
    }

    const rawSender = remoteJid.replace(/@.*$/, '').replace(/[^0-9+]/g, '');
    const senderPhone = rawSender ? (rawSender.startsWith('+') ? rawSender : `+${rawSender}`) : '';
    const senderName = (data.pushName || '').trim() || (senderPhone || 'WhatsApp User');
    const messageId = key.id || `EVO-${Date.now()}`;

    return {
      shouldProcess: true,
      data: {
        source: 'WhatsApp',
        requesterName: senderName,
        requesterPhone: senderPhone,
        description: text,
        location: '',
        messageId
      }
    };
  }

  // 3. Meta / WhatsApp Cloud API format
  // Example: { object: "whatsapp_business_account", entry: [{ changes: [{ value: { messages: [...] } }] }] }
  if (payload.object === 'whatsapp_business_account' || payload.entry) {
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0]?.value;

    // Ignore status updates / read receipts
    if (change?.statuses && change.statuses.length > 0) {
      return { shouldProcess: false, reason: 'Ignored delivery/read status receipt' };
    }

    const msg = change?.messages?.[0];
    if (!msg) {
      return { shouldProcess: false, reason: 'No message in WhatsApp Cloud payload' };
    }

    // Ignore non-text messages
    if (msg.type !== 'text' && !msg.text?.body) {
      return { shouldProcess: false, reason: 'Unsupported non-text message type' };
    }

    const text = (msg.text?.body || '').trim();
    if (!text) {
      return { shouldProcess: false, reason: 'Empty message body' };
    }

    const contact = change.contacts?.[0];
    const senderPhone = msg.from ? (msg.from.startsWith('+') ? msg.from : `+${msg.from}`) : '';
    const senderName = (contact?.profile?.name || '').trim() || (senderPhone || 'WhatsApp User');
    const messageId = msg.id || `META-${Date.now()}`;

    return {
      shouldProcess: true,
      data: {
        source: 'WhatsApp',
        requesterName: senderName,
        requesterPhone: senderPhone,
        description: text,
        location: '',
        messageId
      }
    };
  }

  // 4. Twilio WhatsApp format
  // Example: { From: "whatsapp:+919876543210", Body: "...", ProfileName: "Ananya", MessageSid: "SM..." }
  if (payload.From || payload.Body) {
    const text = (payload.Body || '').trim();
    if (!text) {
      return { shouldProcess: false, reason: 'Empty message text' };
    }

    const rawFrom = payload.From || '';
    const senderPhone = rawFrom.replace('whatsapp:', '').trim();
    const senderName = (payload.ProfileName || '').trim() || (senderPhone || 'WhatsApp User');
    const messageId = payload.MessageSid || `TWILIO-${Date.now()}`;

    return {
      shouldProcess: true,
      data: {
        source: 'WhatsApp',
        requesterName: senderName,
        requesterPhone: senderPhone,
        description: text,
        location: '',
        messageId
      }
    };
  }

  return { shouldProcess: false, reason: 'Unrecognized webhook format' };
}

/**
 * Formats a clean, readable confirmation reply for the user.
 *
 * @param {Object} requestData - Newly created request object
 * @returns {string} Formatted WhatsApp reply message
 */
export function formatConfirmationReply(requestData = {}) {
  const reqId = requestData.id || requestData.requestId || 'REQ-0001';
  const category = requestData.category || 'GENERAL';
  const priority = requestData.priority || 'MEDIUM';
  const department = requestData.department || 'General Support';
  const sla = requestData.slaHours !== undefined ? `${requestData.slaHours} hours` : '24 hours';

  return `Hello! Your request has been registered successfully.\n\nRequest ID: ${reqId}\nCategory: ${category}\nPriority: ${priority}\nDepartment: ${department}\nExpected SLA: ${sla}\n\nWe will notify the responsible department.\n\nThank you for reporting this issue.`;
}

/**
 * Formats a safe user error message.
 *
 * @returns {string} Safe user error reply
 */
export function formatErrorReply() {
  return 'We could not process your request at this time. Please make sure your message clearly describes the issue or try again later.';
}

/**
 * Sends a WhatsApp message to the given recipient phone number.
 * Uses configured WhatsApp API credentials (Evolution API / Meta / Twilio) or gracefully operates in Dev/Mock mode.
 *
 * @param {string} to - Destination phone number
 * @param {string} message - Message text
 * @returns {Promise<Object>} Dispatch result details
 */
export async function sendWhatsAppMessage(to, message) {
  const apiUrl = process.env.WHATSAPP_API_URL || process.env.EVOLUTION_API_URL;
  const apiKey = process.env.WHATSAPP_API_KEY || process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.WHATSAPP_INSTANCE_NAME || process.env.EVOLUTION_INSTANCE_NAME;

  const cleanRecipient = (to || '').replace(/[^0-9+]/g, '');

  if (!cleanRecipient) {
    console.warn('[WhatsApp Service] Warning: Missing recipient phone number for WhatsApp message dispatch.');
    return { success: false, error: 'Recipient phone number is missing' };
  }

  // If live WhatsApp / Evolution API is configured
  if (apiUrl && apiKey) {
    try {
      const sanitizedUrl = apiUrl.replace(/\/$/, '');
      const endpoint = instanceName
        ? `${sanitizedUrl}/message/sendText/${encodeURIComponent(instanceName)}`
        : `${sanitizedUrl}/message/sendText`;

      const formattedNumber = cleanRecipient.replace(/^\+/, '');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey.trim()
        },
        body: JSON.stringify({
          number: formattedNumber,
          text: message
        })
      });

      const resData = await response.json().catch(() => ({}));

      if (response.ok) {
        console.log(`[WhatsApp Service] Message successfully sent to ${cleanRecipient} via live gateway.`);
        return {
          success: true,
          live: true,
          data: resData
        };
      } else {
        console.warn(`[WhatsApp Service] Live API error (${response.status}):`, resData);
        return {
          success: false,
          error: resData.message || `HTTP ${response.status}`
        };
      }
    } catch (err) {
      console.error('[WhatsApp Service] Failed to send message via live WhatsApp API:', err.message);
      return {
        success: false,
        error: err.message
      };
    }
  }

  // Dev / Mock Mode when API keys are not provided
  console.log(`[WhatsApp Service] (Dev/Mock Mode) Sending message to ${cleanRecipient}:\n---\n${message}\n---`);
  return {
    success: true,
    mock: true,
    messageId: `WA-MOCK-${Date.now()}`
  };
}

/**
 * Handle incoming webhook wrapper for backwards-compatibility or standalone tests.
 */
export async function handleIncomingWhatsApp(webhookPayload) {
  const norm = normalizeIncomingPayload(webhookPayload);
  return {
    handled: norm.shouldProcess,
    ...norm
  };
}
