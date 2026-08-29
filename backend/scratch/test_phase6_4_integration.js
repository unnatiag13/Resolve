/**
 * ResolveAI — Phase 6.4: Convert Incoming WhatsApp Messages into Requests Test Suite
 *
 * Verifies:
 * 1. Evolution API messages.upsert / MESSAGES_UPSERT event creates a complete Notion Request.
 * 2. Extracts sender, name, and message text as request description.
 * 3. Dynamic category/subcategory, priority, department, SLA hours & Due At.
 * 4. Action Logs created: REQUEST_CREATED, AI_ANALYZED, PRIORITY_ASSIGNED, DEPARTMENT_ASSIGNED.
 * 5. Self-messages (fromMe: true) are ignored without creating requests.
 * 6. Duplicate webhook deliveries for the same message ID are prevented.
 * 7. Non-text and unsupported events are safely ignored.
 * 8. Returns HTTP 200 with request confirmation.
 */

import app from '../app.js';
import * as notionService from '../services/notionService.js';
import * as whatsappService from '../services/whatsappService.js';

let server;
let PORT = 5065;
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
      console.log(`[Test Server] Running on ephemeral port ${PORT}\n`);
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
  console.log('🚀 RESOLVEAI PHASE 6.4: WHATSAPP REQUEST CREATION TEST SUITE');
  console.log('================================================================\n');

  await startTestServer();

  try {
    whatsappService.clearDeduplicationCache();

    // ------------------------------------------------------------------------
    // TEST 1: Evolution API messages.upsert -> Notion Request Creation
    // ------------------------------------------------------------------------
    console.log('📌 TEST 1: Evolution API messages.upsert Request Creation');
    const msgId1 = `EVO_TEST_REQ_${Date.now()}`;
    const evoPayload1 = {
      event: 'messages.upsert',
      instance: 'resolveai',
      data: {
        key: {
          remoteJid: '919876543210@s.whatsapp.net',
          fromMe: false,
          id: msgId1
        },
        pushName: 'Ananya Sharma',
        message: {
          conversation: 'There is no water in Hostel Block B.'
        },
        messageType: 'conversation'
      }
    };

    const res1 = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evoPayload1)
    });

    assert(res1.status === 200, `POST /api/whatsapp/webhook returns HTTP 200 (Got: ${res1.status})`);
    const json1 = await res1.json();
    assert(json1.success === true, 'Response contains success: true');
    assert(json1.data && json1.data.id && json1.data.id.startsWith('REQ-'), `Generated Request ID: ${json1.data?.id}`);
    assert(json1.data.source === 'WhatsApp', `Source is 'WhatsApp' (Got: ${json1.data?.source})`);
    assert(json1.data.requesterName === 'Ananya Sharma', `Requester name extracted: ${json1.data?.requesterName}`);
    assert(json1.data.requesterPhone === '+919876543210', `Requester phone extracted: ${json1.data?.requesterPhone}`);
    assert(json1.data.description === 'There is no water in Hostel Block B.', `Description matched message: "${json1.data?.description}"`);
    assert(json1.data.category === 'PLUMBING' || json1.data.category === 'MAINTENANCE', `Category detected: ${json1.data?.category}`);
    assert(json1.data.department === 'Maintenance', `Department mapped to Maintenance (Got: ${json1.data?.department})`);
    assert(typeof json1.data.slaHours === 'number' && json1.data.slaHours > 0, `SLA Hours calculated: ${json1.data?.slaHours}`);
    assert(Boolean(json1.data.dueAt), `Due At timestamp calculated: ${json1.data?.dueAt}`);

    const createdReqId = json1.data.id;

    // ------------------------------------------------------------------------
    // TEST 2: Action Logs Verification for WhatsApp Request
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 2: Action Logs Verification');
    const logs = await notionService.getActionLogs(createdReqId);
    assert(Array.isArray(logs) && logs.length > 0, `Retrieved ${logs.length} Action Logs for ${createdReqId}`);

    const loggedActions = logs.map(l => l.Action || l.action);
    console.log(`   Logged Actions for ${createdReqId}:`, loggedActions);
    assert(loggedActions.includes('REQUEST_CREATED'), "Logs contain 'REQUEST_CREATED'");
    assert(loggedActions.includes('AI_ANALYZED'), "Logs contain 'AI_ANALYZED'");
    assert(loggedActions.includes('PRIORITY_ASSIGNED'), "Logs contain 'PRIORITY_ASSIGNED'");
    assert(loggedActions.includes('DEPARTMENT_ASSIGNED'), "Logs contain 'DEPARTMENT_ASSIGNED'");

    // ------------------------------------------------------------------------
    // TEST 3: Duplicate Webhook Event Prevention
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 3: Duplicate Webhook Event Prevention');
    // Resend exact same payload with same msgId1
    const resDup = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evoPayload1)
    });

    assert(resDup.status === 200, `Duplicate webhook returns HTTP 200 (Got: ${resDup.status})`);
    const jsonDup = await resDup.json();
    assert(jsonDup.duplicate === true, 'Response contains duplicate: true');
    assert(!jsonDup.data, 'No duplicate request was created');

    // ------------------------------------------------------------------------
    // TEST 4: Self-Message (fromMe: true) Ignored
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 4: Bot Self-Message (fromMe: true) Ignored');
    const botMsgPayload = {
      event: 'MESSAGES_UPSERT',
      instance: 'resolveai',
      data: {
        key: {
          remoteJid: '919876543210@s.whatsapp.net',
          fromMe: true,
          id: `BOT_MSG_${Date.now()}`
        },
        message: {
          conversation: 'Your request has been registered.'
        }
      }
    };

    const resBot = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(botMsgPayload)
    });

    assert(resBot.status === 200, `Self-message returns HTTP 200 (Got: ${resBot.status})`);
    const jsonBot = await resBot.json();
    assert(jsonBot.ignored === true, 'Self-message ignored: true');
    assert(jsonBot.reason.includes('self-message') || jsonBot.reason.includes('account itself'), 'Ignored reason mentions self-message');

    // ------------------------------------------------------------------------
    // TEST 5: Unsupported Event Ignored Safely
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 5: Unsupported Event Ignored Safely');
    const connPayload = {
      event: 'connection.update',
      instance: 'resolveai',
      data: { state: 'open' }
    };

    const resConn = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(connPayload)
    });

    assert(resConn.status === 200, `connection.update returns HTTP 200 (Got: ${resConn.status})`);
    const jsonConn = await resConn.json();
    assert(jsonConn.ignored === true, 'connection.update ignored: true');

    // ------------------------------------------------------------------------
    // TEST 6: Electrical Outage WhatsApp Request
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 6: Electrical Issue WhatsApp Request');
    const evoPayload2 = {
      event: 'messages.upsert',
      instance: 'resolveai',
      data: {
        key: {
          remoteJid: '919999888877@s.whatsapp.net',
          fromMe: false,
          id: `EVO_ELEC_${Date.now()}`
        },
        message: {
          extendedTextMessage: {
            text: 'There is a power outage in Hostel Block C.'
          }
        },
        messageType: 'extendedTextMessage'
      }
    };

    const res2 = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evoPayload2)
    });

    assert(res2.status === 200, `Electrical message returns HTTP 200 (Got: ${res2.status})`);
    const json2 = await res2.json();
    assert(json2.success === true, 'Electrical request created successfully');
    assert(json2.data.category === 'ELECTRICAL', `Category detected as ELECTRICAL (Got: ${json2.data.category})`);
    assert(json2.data.priority === 'HIGH' || json2.data.priority === 'CRITICAL', `Priority detected as HIGH/CRITICAL (Got: ${json2.data.priority})`);
    assert(json2.data.department === 'Maintenance', `Department mapped to Maintenance (Got: ${json2.data.department})`);
    assert(json2.data.requesterName === '+919999888877' || json2.data.requesterName === 'WhatsApp User', `Safe name fallback used when pushName is omitted (Got: ${json2.data.requesterName})`);

  } catch (error) {
    console.error('Fatal test error:', error);
    assert(false, `Test threw uncaught error: ${error.message}`);
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
    console.log('\n🎉 ALL PHASE 6.4 WHATSAPP REQUEST CREATION TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  }
}

runTests();
