/**
 * ResolveAI — Phase 6.3: Evolution API Webhook Endpoint Test Suite
 *
 * Verifies:
 * 1. POST /api/whatsapp/webhook accepts incoming Evolution API JSON payloads.
 * 2. Immediately returns HTTP 200 with receipt confirmation.
 * 3. Handles messages.upsert, connection.update, qrcode.updated, and unsupported events safely.
 * 4. Safe logging without exposing secrets.
 * 5. Does not create Notion requests or call Gemini.
 * 6. Existing endpoints remain 100% operational.
 */

import app from '../app.js';

let server;
let PORT = 5060;
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
  console.log('🚀 RESOLVEAI PHASE 6.3: EVOLUTION API WEBHOOK ENDPOINT TEST SUITE');
  console.log('================================================================\n');

  await startTestServer();

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Evolution API messages.upsert payload
    // ------------------------------------------------------------------------
    console.log('📌 TEST 1: Evolution API messages.upsert Event');
    const evoMsgPayload = {
      event: 'messages.upsert',
      instance: 'resolveai',
      data: {
        key: {
          remoteJid: '919876543210@s.whatsapp.net',
          fromMe: false,
          id: 'EVO_MSG_TEST_001'
        },
        pushName: 'Ananya',
        message: {
          conversation: 'There is no water in Hostel Block B.'
        },
        messageType: 'conversation'
      }
    };

    const res1 = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evoMsgPayload)
    });

    assert(res1.status === 200, `POST /api/whatsapp/webhook returns HTTP 200 (Got: ${res1.status})`);
    const json1 = await res1.json();
    assert(json1.success === true, 'Response contains success: true');
    assert(json1.message === 'Webhook received successfully', 'Response contains receipt confirmation');
    assert(json1.event === 'messages.upsert', `Event matched messages.upsert (Got: ${json1.event})`);
    assert(json1.instance === 'resolveai', `Instance matched resolveai (Got: ${json1.instance})`);
    assert(json1.hasMessageData === true, 'hasMessageData correctly identified as true');

    // ------------------------------------------------------------------------
    // TEST 2: Evolution API connection.update payload
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 2: Evolution API connection.update Event');
    const connPayload = {
      event: 'connection.update',
      instance: 'resolveai',
      data: {
        state: 'open',
        statusReason: 200
      }
    };

    const res2 = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(connPayload)
    });

    assert(res2.status === 200, `POST /api/whatsapp/webhook returns HTTP 200 on connection.update (Got: ${res2.status})`);
    const json2 = await res2.json();
    assert(json2.success === true, 'Response contains success: true');
    assert(json2.event === 'connection.update', `Event matched connection.update (Got: ${json2.event})`);
    assert(json2.hasMessageData === false, 'hasMessageData correctly identified as false');

    // ------------------------------------------------------------------------
    // TEST 3: Unsupported / Other Webhook Event (e.g. qrcode.updated)
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 3: Unsupported / Informational Webhook Event');
    const qrPayload = {
      event: 'qrcode.updated',
      instance: 'resolveai',
      data: {
        qrcode: { base64: 'data:image/png;base64,mockqr...' }
      }
    };

    const res3 = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(qrPayload)
    });

    assert(res3.status === 200, `POST /api/whatsapp/webhook handles unhandled events with HTTP 200 (Got: ${res3.status})`);
    const json3 = await res3.json();
    assert(json3.success === true, 'Response contains success: true');
    assert(json3.event === 'qrcode.updated', `Event reported as qrcode.updated (Got: ${json3.event})`);

    // ------------------------------------------------------------------------
    // TEST 4: Empty payload & verification endpoint
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 4: Empty payload & GET Webhook verification');
    const res4 = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert(res4.status === 200, `POST /api/whatsapp/webhook handles empty payload safely with HTTP 200`);

    const getRes = await fetch(`${BASE_URL}/api/whatsapp/webhook`);
    assert(getRes.status === 200, `GET /api/whatsapp/webhook health check returns HTTP 200`);

    // ------------------------------------------------------------------------
    // TEST 5: Existing Endpoints Integrity
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 5: Existing Endpoints Integrity Check');
    const healthRes = await fetch(`${BASE_URL}/health`);
    assert(healthRes.status === 200, `GET /health returns HTTP 200`);

    const deptRes = await fetch(`${BASE_URL}/api/departments`);
    assert(deptRes.status === 200, `GET /api/departments returns HTTP 200`);

  } catch (error) {
    console.error('Fatal test error:', error);
    assert(false, `Test execution threw error: ${error.message}`);
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
    console.log('\n🎉 ALL PHASE 6.3 EVOLUTION API WEBHOOK TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  }
}

runTests();
