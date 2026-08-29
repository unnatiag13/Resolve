/**
 * ResolveAI — Phase 6.1: WhatsApp Request Intake Comprehensive Test Suite
 *
 * Tests:
 * 1. Webhook endpoint verification (GET /api/whatsapp/webhook)
 * 2. Multi-provider payload normalization (Evolution API, Meta, Twilio, Direct)
 * 3. Safe filtering (bot echo, receipts, groups, empty/non-text)
 * 4. Deduplication prevention (preventing loops and duplicate requests)
 * 5. End-to-end WhatsApp request intake & Notion pipeline execution
 * 6. Confirmation message formatting with dynamic values
 * 7. Safe fallback for missing sender name
 * 8. Backward compatibility for Web form requests (POST /api/requests)
 */

import http from 'http';
import app from '../app.js';
import * as whatsappService from '../services/whatsappService.js';
import * as notionService from '../services/notionService.js';

let server;
let PORT = 5057;
let BASE_URL = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAILED: ${message}`);
    failed++;
    failures.push(message);
  }
}

async function startTestServer() {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      PORT = server.address().port;
      BASE_URL = `http://localhost:${PORT}`;
      console.log(`[Test Server] Running on ephemeral port ${PORT}`);
      resolve();
    });
  });
}

async function stopTestServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🚀 RESOLVEAI PHASE 6.1: WHATSAPP REQUEST INTAKE TEST SUITE');
  console.log('================================================================\n');

  await startTestServer();

  try {
    // ------------------------------------------------------------------------
    // CHECKPOINT 1: Webhook Endpoint Verification & Health
    // ------------------------------------------------------------------------
    console.log('📌 CHECKPOINT 1: Webhook Endpoint Verification');
    const getRes = await fetch(`${BASE_URL}/api/whatsapp/webhook`);
    assert(getRes.status === 200, `GET /api/whatsapp/webhook returns HTTP 200 (Got ${getRes.status})`);
    const getJson = await getRes.json();
    assert(getJson.success === true, 'Webhook health check returns success: true');

    // Meta challenge verification test
    const metaRes = await fetch(`${BASE_URL}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test&hub.challenge=CHALLENGE_123`);
    assert(metaRes.status === 200, 'Meta webhook verification challenge succeeds');

    // ------------------------------------------------------------------------
    // CHECKPOINT 2: Payload Normalization & Safe Filtering (Unit Tests)
    // ------------------------------------------------------------------------
    console.log('\n📌 CHECKPOINT 2: Multi-Provider Normalization & Filtering');

    // 2a. Direct payload
    const directNorm = whatsappService.normalizeIncomingPayload({
      requesterName: 'Ananya',
      requesterPhone: '+919876543210',
      description: 'There is a power outage in Hostel Block C.'
    });
    assert(directNorm.shouldProcess === true, 'Direct payload marked for processing');
    assert(directNorm.data.description === 'There is a power outage in Hostel Block C.', 'Direct payload text extracted correctly');
    assert(directNorm.data.requesterPhone === '+919876543210', 'Direct payload phone extracted');
    assert(directNorm.data.source === 'WhatsApp', 'Direct payload source set to WhatsApp');

    // 2b. Evolution API payload
    const evoPayload = {
      event: 'messages.upsert',
      data: {
        key: {
          remoteJid: '919812345678@s.whatsapp.net',
          fromMe: false,
          id: 'EVO_TEST_MSG_1'
        },
        pushName: 'Rahul Sharma',
        message: {
          conversation: 'There is no water in Hostel Block B.'
        }
      }
    };
    const evoNorm = whatsappService.normalizeIncomingPayload(evoPayload);
    assert(evoNorm.shouldProcess === true, 'Evolution API message marked for processing');
    assert(evoNorm.data.requesterName === 'Rahul Sharma', 'Evolution API sender name extracted');
    assert(evoNorm.data.requesterPhone === '+919812345678', 'Evolution API phone extracted and formatted');
    assert(evoNorm.data.description === 'There is no water in Hostel Block B.', 'Evolution API message text extracted');

    // 2c. Meta Cloud API payload
    const metaPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            contacts: [{ profile: { name: 'Priya' }, wa_id: '919999888877' }],
            messages: [{
              from: '919999888877',
              id: 'wamid_123',
              type: 'text',
              text: { body: 'Projector in LH-101 is not turning on.' }
            }]
          }
        }]
      }]
    };
    const metaNorm = whatsappService.normalizeIncomingPayload(metaPayload);
    assert(metaNorm.shouldProcess === true, 'Meta Cloud API message marked for processing');
    assert(metaNorm.data.requesterName === 'Priya', 'Meta Cloud API sender name extracted');
    assert(metaNorm.data.description.includes('Projector in LH-101'), 'Meta Cloud API message text extracted');

    // 2d. Bot's own outgoing message (fromMe: true) filter
    const botEchoPayload = {
      event: 'messages.upsert',
      data: {
        key: {
          remoteJid: '919812345678@s.whatsapp.net',
          fromMe: true, // Bot echo
          id: 'BOT_ECHO_1'
        },
        message: { conversation: 'Your request has been registered.' }
      }
    };
    const botEchoNorm = whatsappService.normalizeIncomingPayload(botEchoPayload);
    assert(botEchoNorm.shouldProcess === false, 'Bot own outgoing message correctly ignored');

    // 2e. Status update / receipt filter
    const statusPayload = {
      event: 'messages.update',
      data: { key: { id: 'EVO_123' }, update: { status: 'READ' } }
    };
    const statusNorm = whatsappService.normalizeIncomingPayload(statusPayload);
    assert(statusNorm.shouldProcess === false, 'Status update/receipt correctly ignored');

    // 2f. Group message filter
    const groupPayload = {
      event: 'messages.upsert',
      data: {
        key: { remoteJid: '123456789@g.us', fromMe: false, id: 'GRP_1' },
        message: { conversation: 'Hello group' }
      }
    };
    const groupNorm = whatsappService.normalizeIncomingPayload(groupPayload);
    assert(groupNorm.shouldProcess === false, 'Group message correctly ignored');

    // 2g. Non-text message filter
    const nonTextPayload = {
      event: 'messages.upsert',
      data: {
        key: { remoteJid: '919812345678@s.whatsapp.net', fromMe: false, id: 'STK_1' },
        message: { stickerMessage: {} }
      }
    };
    const nonTextNorm = whatsappService.normalizeIncomingPayload(nonTextPayload);
    assert(nonTextNorm.shouldProcess === false, 'Non-text message without text correctly ignored');

    // ------------------------------------------------------------------------
    // CHECKPOINT 3: Webhook Deduplication Prevention
    // ------------------------------------------------------------------------
    console.log('\n📌 CHECKPOINT 3: Webhook Deduplication Prevention');
    whatsappService.clearDeduplicationCache();
    const testDedupId = `TEST_DEDUP_${Date.now()}`;
    const isFirstTime = whatsappService.isDuplicateEvent(testDedupId);
    assert(isFirstTime === false, 'First occurrence of event ID is NOT duplicate');
    const isSecondTime = whatsappService.isDuplicateEvent(testDedupId);
    assert(isSecondTime === true, 'Second occurrence of identical event ID IS duplicate');

    // ------------------------------------------------------------------------
    // CHECKPOINT 4: End-to-End WhatsApp Intake Webhook
    // ------------------------------------------------------------------------
    console.log('\n📌 CHECKPOINT 4: End-to-End WhatsApp Request Intake');
    const waPayload1 = {
      requesterName: 'Ananya',
      requesterPhone: '+919876543210',
      source: 'WhatsApp',
      description: 'There is a power outage in Hostel Block C.'
    };

    const webhookRes = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(waPayload1)
    });

    assert(webhookRes.status === 201, `Webhook returns HTTP 201 Created (Got: ${webhookRes.status})`);
    const waJson1 = await webhookRes.json();

    assert(waJson1.success === true, 'Webhook response success is true');
    assert(waJson1.data && waJson1.data.id && waJson1.data.id.startsWith('REQ-'), `Generated Request ID: ${waJson1.data?.id}`);
    assert(waJson1.data.source === 'WhatsApp', `Request source is correctly 'WhatsApp' (Got: ${waJson1.data.source})`);
    assert(waJson1.data.requesterPhone === '+919876543210', `Requester Phone is preserved (Got: ${waJson1.data.requesterPhone})`);
    assert(waJson1.data.category === 'ELECTRICAL', `Category detected as ELECTRICAL (Got: ${waJson1.data.category})`);
    assert(waJson1.data.priority === 'HIGH' || waJson1.data.priority === 'CRITICAL', `Priority assigned high urgency (Got: ${waJson1.data.priority})`);
    assert(waJson1.data.department === 'Maintenance', `Department correctly mapped to Maintenance (Got: ${waJson1.data.department})`);
    assert(typeof waJson1.data.slaHours === 'number' && waJson1.data.slaHours > 0, `SLA Hours computed (Got: ${waJson1.data.slaHours})`);
    assert(Boolean(waJson1.data.dueAt), `Due At timestamp calculated (Got: ${waJson1.data.dueAt})`);
    assert(waJson1.replySent === true, 'WhatsApp confirmation reply dispatch succeeded');

    // ------------------------------------------------------------------------
    // CHECKPOINT 5: Verify Confirmation Message Content
    // ------------------------------------------------------------------------
    console.log('\n📌 CHECKPOINT 5: WhatsApp Confirmation Reply Content');
    const confirmationText = whatsappService.formatConfirmationReply(waJson1.data);
    console.log('   --- Confirmation Message Preview ---');
    console.log(confirmationText.split('\n').map(l => `   | ${l}`).join('\n'));
    console.log('   ------------------------------------');

    assert(confirmationText.includes('Your request has been registered successfully.'), 'Confirmation header present');
    assert(confirmationText.includes(`Request ID: ${waJson1.data.id}`), 'Dynamic Request ID present in reply');
    assert(confirmationText.includes(`Priority: ${waJson1.data.priority}`), 'Dynamic Priority present in reply');
    assert(confirmationText.includes(`Department: ${waJson1.data.department}`), 'Dynamic Department present in reply');
    assert(confirmationText.includes(`SLA: ${waJson1.data.slaHours} hours`), 'Dynamic SLA hours present in reply');

    // ------------------------------------------------------------------------
    // CHECKPOINT 6: Action Logs Generation for WhatsApp Request
    // ------------------------------------------------------------------------
    console.log('\n📌 CHECKPOINT 6: Action Logs Verification');
    const logsRes = await fetch(`${BASE_URL}/api/requests/${waJson1.data.id}/logs`);
    assert(logsRes.status === 200, `GET /api/requests/${waJson1.data.id}/logs returns HTTP 200`);
    const logsJson = await logsRes.json();
    assert(logsJson.success === true && Array.isArray(logsJson.data), 'Action logs retrieved as array');

    const actionTypes = logsJson.data.map(l => l.Action || l.action);
    console.log(`   Logged Actions: ${actionTypes.join(', ')}`);
    assert(actionTypes.includes('REQUEST_CREATED'), "Action Log includes 'REQUEST_CREATED'");
    assert(actionTypes.includes('AI_ANALYZED'), "Action Log includes 'AI_ANALYZED'");
    assert(actionTypes.includes('PRIORITY_ASSIGNED'), "Action Log includes 'PRIORITY_ASSIGNED'");
    assert(actionTypes.includes('DEPARTMENT_ASSIGNED'), "Action Log includes 'DEPARTMENT_ASSIGNED'");

    // ------------------------------------------------------------------------
    // CHECKPOINT 7: Evolution API Webhook Simulation with Safe Fallback for Name
    // ------------------------------------------------------------------------
    console.log('\n📌 CHECKPOINT 7: Evolution API Format & Safe Name Fallback');
    const evoWebhookPayload = {
      event: 'messages.upsert',
      data: {
        key: {
          remoteJid: '919876500000@s.whatsapp.net',
          fromMe: false,
          id: `EVO_PLUMBING_${Date.now()}`
        },
        // pushName omitted to test fallback
        message: {
          conversation: 'There is a major water leak in the washroom of Nilgiri Hostel Block A.'
        }
      }
    };

    const evoRes = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evoWebhookPayload)
    });

    assert(evoRes.status === 201, `Evolution API webhook returns HTTP 201 Created (Got: ${evoRes.status})`);
    const evoJson = await evoRes.json();
    assert(evoJson.success === true, 'Evolution request created successfully');
    assert(evoJson.data.requesterName === '+919876500000' || evoJson.data.requesterName === 'WhatsApp User', `Safe name fallback applied (Got: ${evoJson.data.requesterName})`);
    assert(evoJson.data.category === 'PLUMBING' || evoJson.data.category === 'MAINTENANCE', `Plumbing category detected (Got: ${evoJson.data.category})`);
    assert(evoJson.data.department === 'Maintenance', `Department mapped to Maintenance (Got: ${evoJson.data.department})`);

    // ------------------------------------------------------------------------
    // CHECKPOINT 8: Duplicate Webhook Event Prevention (via HTTP Endpoint)
    // ------------------------------------------------------------------------
    console.log('\n📌 CHECKPOINT 8: HTTP Duplicate Webhook Event Prevention');
    // Resend the exact same evoWebhookPayload
    const dupRes = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evoWebhookPayload)
    });

    assert(dupRes.status === 200, `Duplicate webhook returns HTTP 200 OK (Got: ${dupRes.status})`);
    const dupJson = await dupRes.json();
    assert(dupJson.duplicate === true, 'Duplicate webhook response contains duplicate: true');
    assert(!dupJson.data, 'No duplicate request record was created');

    // ------------------------------------------------------------------------
    // CHECKPOINT 9: Ignored Events (Bot Echo, Status Update, Non-text) via HTTP
    // ------------------------------------------------------------------------
    console.log('\n📌 CHECKPOINT 9: Ignored Events via HTTP');
    const ignoreRes = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(botEchoPayload)
    });
    assert(ignoreRes.status === 200, `Ignored event returns HTTP 200 (Got: ${ignoreRes.status})`);
    const ignoreJson = await ignoreRes.json();
    assert(ignoreJson.ignored === true, 'Response contains ignored: true');

    // ------------------------------------------------------------------------
    // CHECKPOINT 10: Backward Compatibility — Web Form Request (POST /api/requests)
    // ------------------------------------------------------------------------
    console.log('\n📌 CHECKPOINT 10: Backward Compatibility for Web Form (POST /api/requests)');
    const webRes = await fetch(`${BASE_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterName: 'Web Student',
        requesterEmail: 'student@example.com',
        location: 'Library 2nd Floor',
        description: 'Wi-Fi connection is dropping repeatedly on the second floor.'
      })
    });

    assert(webRes.status === 201, `Web form POST /api/requests returns HTTP 201 (Got: ${webRes.status})`);
    const webJson = await webRes.json();
    assert(webJson.success === true, 'Web request created successfully');
    assert(webJson.data.source === 'Web', `Web request source is 'Web' (Got: ${webJson.data.source})`);
    assert(webJson.data.requesterEmail === 'student@example.com', 'Web request email preserved');
    assert(webJson.data.category === 'IT' || webJson.data.category === 'IT_SERVICES', `IT category detected (Got: ${webJson.data.category})`);

    // Missing email in Web request should still fail with 400 validation error
    const invalidWebRes = await fetch(`${BASE_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterName: 'Web Student',
        location: 'Library',
        description: 'No email provided'
      })
    });
    assert(invalidWebRes.status === 400, `Web form without email returns HTTP 400 validation error (Got: ${invalidWebRes.status})`);

  } catch (error) {
    console.error('Fatal test error:', error);
    assert(false, `Test execution threw an uncaught error: ${error.message}`);
  } finally {
    await stopTestServer();
  }

  // ------------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');
  if (failed > 0) {
    console.error('\nFailures:');
    failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL PHASE 6.1 WHATSAPP INTEGRATION TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  }
}

runTests();
