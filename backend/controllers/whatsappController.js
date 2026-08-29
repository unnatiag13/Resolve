import * as whatsappService from '../services/whatsappService.js';
import { processIncomingRequest } from '../services/requestProcessingService.js';

/**
 * POST /api/whatsapp/webhook
 * Handles incoming WhatsApp webhook events from Evolution API.
 * Converts incoming WhatsApp messages into ResolveAI requests in Notion and sends an automatic confirmation back to the sender.
 */
export async function handleWebhook(req, res) {
  try {
    const rawPayload = req.body;
    console.log('WhatsApp webhook received');

    // 1. Normalize and validate incoming Evolution API payload
    const normalized = whatsappService.normalizeIncomingPayload(rawPayload);

    if (!normalized.shouldProcess) {
      console.log(`[WhatsApp Webhook] Event ignored: ${normalized.reason}`);
      return res.status(200).json({
        success: true,
        ignored: true,
        reason: normalized.reason
      });
    }

    const { requesterName, requesterPhone, description, location, messageId } = normalized.data;

    // 2. Prevent duplicate request creation on duplicate webhook delivery
    if (whatsappService.isDuplicateEvent(messageId)) {
      console.log(`[WhatsApp Webhook] Duplicate WhatsApp message delivery skipped for message ID: ${messageId}`);
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: 'Duplicate WhatsApp message delivery ignored'
      });
    }

    // 3. Log extracted message safely (no secrets exposed)
    console.log(`Incoming message extracted: From: ${requesterPhone || 'N/A'} (${requesterName}), Text: "${description.substring(0, 60)}${description.length > 60 ? '...' : ''}"`);
    console.log('Creating ResolveAI request');

    // 4. Pass incoming WhatsApp message through central request creation pipeline
    // Uses existing request analyzer, category/subcategory/priority/department detection, SLA, Notion DB, and Action Logs
    const createdRequest = await processIncomingRequest({
      source: 'WhatsApp',
      requesterName,
      requesterPhone,
      description,
      location: location || '',
      forceFallback: Boolean(req.body.forceFallback)
    });

    console.log(`Request created successfully: ${createdRequest.id || createdRequest.requestId}`);

    // 5. Send automatic WhatsApp confirmation to the sender ONLY after Notion creation and Action Logs succeed
    let confirmationResult = { success: false };
    if (requesterPhone) {
      console.log('Sending WhatsApp confirmation');
      try {
        const confirmationMessage = whatsappService.formatConfirmationReply(createdRequest);
        confirmationResult = await whatsappService.sendWhatsAppMessage(requesterPhone, confirmationMessage);

        if (confirmationResult.success) {
          console.log('WhatsApp confirmation sent successfully');
        } else {
          console.warn(`WhatsApp confirmation failed: ${confirmationResult.error || 'Unknown error'}`);
        }
      } catch (sendErr) {
        console.error(`WhatsApp confirmation failed: ${sendErr.message}`);
      }
    }

    // 6. Respond with HTTP 200 quickly and safely
    return res.status(200).json({
      success: true,
      message: 'WhatsApp message processed and request created successfully',
      data: createdRequest,
      confirmationSent: Boolean(confirmationResult?.success)
    });
  } catch (error) {
    console.error('[WhatsApp Webhook Error]:', error.message);
    // Return HTTP 200 with error details to prevent Evolution API from infinitely retrying
    return res.status(200).json({
      success: false,
      message: 'Error processing WhatsApp request',
      error: error.message
    });
  }
}

/**
 * GET /api/whatsapp/webhook
 * Verification endpoint for Meta/WhatsApp Cloud API handshake and health checks.
 */
export async function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedSecret = process.env.WHATSAPP_WEBHOOK_SECRET || process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode && token) {
    if (mode === 'subscribe' && (!expectedSecret || token === expectedSecret)) {
      console.log('[WhatsApp Controller] Webhook challenge verified successfully.');
      return res.status(200).send(challenge);
    } else {
      return res.status(403).json({ success: false, message: 'Forbidden: Verification token mismatch.' });
    }
  }

  // Basic health response if accessed directly
  res.status(200).json({
    success: true,
    message: 'ResolveAI WhatsApp Webhook endpoint is active and operational.'
  });
}
