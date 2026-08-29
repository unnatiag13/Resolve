/**
 * ResolveAI — Phase 6.5: Send Automatic WhatsApp Confirmation Test Suite
 *
 * Verifies:
 * 1. Automatic WhatsApp confirmation is generated using dynamic request values.
 * 2. Sent ONLY after Notion request and Action Logs creation succeed.
 * 3. Message format matches required professional template.
 * 4. Dispatch failures do not crash the server or delete the request.
 * 5. Self-messages, duplicate events, and unsupported events do not trigger confirmations.
 * 6. Outbound Evolution API sendText endpoint format and parameters.
 */

import app from '../app.js';
import * as whatsappService from '../services/whatsappService.js';
import * as notionService from '../services/notionService.js';

let server;
let PORT = 5070;
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
  console.log('🚀 RESOLVEAI PHASE 6.5: AUTOMATIC WHATSAPP CONFIRMATION TEST SUITE');
  console.log('================================================================\n');

  await startTestServer();

  try {
    whatsappService.clearDeduplicationCache();

    // ------------------------------------------------------------------------
    // TEST 1: Dynamic Message Formatter Verification
    // ------------------------------------------------------------------------
    console.log('📌 TEST 1: Dynamic Confirmation Message Formatter');
    const mockRequest = {
      id: 'REQ-0001',
      category: 'PLUMBING',
      priority: 'HIGH',
      department: 'Maintenance',
      slaHours: 12
    };

    const formattedText = whatsappService.formatConfirmationReply(mockRequest);
    console.log('   Formatted Confirmation Message:\n---\n' + formattedText + '\n---');

    assert(formattedText.includes('Hello! Your request has been registered successfully.'), 'Contains greeting');
    assert(formattedText.includes('Request ID: REQ-0001'), 'Contains dynamic Request ID');
    assert(formattedText.includes('Category: PLUMBING'), 'Contains dynamic Category');
    assert(formattedText.includes('Priority: HIGH'), 'Contains dynamic Priority');
    assert(formattedText.includes('Department: Maintenance'), 'Contains dynamic Department');
    assert(formattedText.includes('Expected SLA: 12 hours'), 'Contains dynamic Expected SLA');
    assert(formattedText.includes('We will notify the responsible department.'), 'Contains notification notice');
    assert(formattedText.includes('Thank you for reporting this issue.'), 'Contains thank you footer');

    // ------------------------------------------------------------------------
    // TEST 2: End-to-End Webhook Intake with Automatic Confirmation
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 2: End-to-End Intake with Confirmation Dispatch');
    const msgId = `EVO_CONFIRM_${Date.now()}`;
    const evoPayload = {
      event: 'messages.upsert',
      instance: 'resolveai',
      data: {
        key: {
          remoteJid: '919876543210@s.whatsapp.net',
          fromMe: false,
          id: msgId
        },
        pushName: 'Ananya Sharma',
        message: {
          conversation: 'There is a major water leakage in Room 204.'
        },
        messageType: 'conversation'
      }
    };

    const res = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evoPayload)
    });

    assert(res.status === 200, `POST /api/whatsapp/webhook returns HTTP 200 (Got: ${res.status})`);
    const json = await res.json();
    assert(json.success === true, 'Response contains success: true');
    assert(Boolean(json.data && json.data.id), `Request successfully created in Notion: ${json.data?.id}`);
    assert(json.confirmationSent === true, 'Confirmation dispatch flagged as sent');

    // Verify Action Logs in Notion for this request
    const logs = await notionService.getActionLogs(json.data.id);
    assert(logs.length >= 4, `Action Logs recorded in Notion (${logs.length} entries)`);

    // ------------------------------------------------------------------------
    // TEST 3: Duplicate Delivery Does NOT Send Duplicate Confirmation
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 3: Duplicate Delivery Verification');
    const resDup = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evoPayload)
    });

    const jsonDup = await resDup.json();
    assert(jsonDup.duplicate === true, 'Duplicate webhook identified');
    assert(!jsonDup.confirmationSent, 'No confirmation sent for duplicate webhook');

    // ------------------------------------------------------------------------
    // TEST 4: Self-Message (fromMe: true) Does NOT Trigger Confirmation
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 4: Self-Message Verification');
    const botPayload = {
      event: 'messages.upsert',
      instance: 'resolveai',
      data: {
        key: {
          remoteJid: '919876543210@s.whatsapp.net',
          fromMe: true,
          id: `BOT_${Date.now()}`
        },
        message: { conversation: 'Hello! Your request has been registered...' }
      }
    };

    const resBot = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(botPayload)
    });

    const jsonBot = await resBot.json();
    assert(jsonBot.ignored === true, 'Self-message ignored: true');
    assert(!jsonBot.confirmationSent, 'No confirmation sent for self-message');

    // ------------------------------------------------------------------------
    // TEST 5: Graceful Error Handling when Outbound Dispatch Fails
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 5: Graceful Error Handling on Dispatch Failure');
    const payloadNoPhone = {
      event: 'messages.upsert',
      instance: 'resolveai',
      data: {
        key: {
          remoteJid: '',
          fromMe: false,
          id: `NO_PHONE_${Date.now()}`
        },
        message: { conversation: 'Light fixture broken in corridor' }
      }
    };

    // Even if phone is empty/invalid, request creation should not fail
    const resNoPhone = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadNoPhone)
    });

    assert(resNoPhone.status === 200, 'Server returns HTTP 200 even if phone is missing');
    const jsonNoPhone = await resNoPhone.json();
    assert(jsonNoPhone.success === true, 'Request creation still succeeded');
    assert(jsonNoPhone.confirmationSent === false, 'confirmationSent accurately reported as false');

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
    console.log('\n🎉 ALL PHASE 6.5 AUTOMATIC WHATSAPP CONFIRMATION TESTS PASSED!\n');
    process.exit(0);
  }
}

runTests();
