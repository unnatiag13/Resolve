/**
 * ResolveAI Phase 5.1.6: Complete Web Form Integration Test Suite
 * Tests all 12 integration checkpoints against live running backend (5000) and frontend (5173).
 */

const BACKEND_URL = 'http://localhost:5000';
const FRONTEND_URL = 'http://localhost:5173';

const TEST_DATA = {
  requesterName: 'Test Student',
  requesterEmail: 'test@example.com',
  location: 'Hostel Block B',
  description: 'There is no water available in the hostel bathrooms.'
};

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

async function runTests() {
  console.log('================================================================');
  console.log('🚀 RESOLVEAI PHASE 5.1.6: COMPLETE INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  // TEST 1: Frontend starts successfully
  console.log('📌 CHECKPOINT 1: Frontend Server Availability');
  try {
    const res = await fetch(FRONTEND_URL);
    assert(res.status === 200, `Frontend returns HTTP 200 on ${FRONTEND_URL} (Got: ${res.status})`);
    const html = await res.text();
    assert(html.includes('<!doctype html>') || html.includes('<html'), 'Frontend serves valid HTML application root');
  } catch (err) {
    assert(false, `Frontend server check failed: ${err.message}`);
  }

  // TEST 2: Backend starts successfully
  console.log('\n📌 CHECKPOINT 2: Backend Server Health');
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    assert(res.status === 200, `Backend /health returns HTTP 200 (Got: ${res.status})`);
    const data = await res.json();
    assert(data.success === true, 'Backend health returns success: true');
  } catch (err) {
    assert(false, `Backend health check failed: ${err.message}`);
  }

  // TEST 3: CORS Configuration for local frontend
  console.log('\n📌 CHECKPOINT 3 & 4: CORS Configuration & Communication');
  try {
    const res = await fetch(`${BACKEND_URL}/api/requests`, {
      method: 'OPTIONS',
      headers: {
        'Origin': FRONTEND_URL,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    assert(res.status === 200 || res.status === 204, `CORS preflight returns HTTP 200/204 (Got: ${res.status})`);
    const allowOrigin = res.headers.get('access-control-allow-origin');
    assert(allowOrigin === '*' || allowOrigin === FRONTEND_URL, `CORS allow origin permits frontend (Got: ${allowOrigin})`);
  } catch (err) {
    assert(false, `CORS test failed: ${err.message}`);
  }

  // TEST 5, 6, 7, 8: Submit Test Data & Verify Pipeline, Notion, Logs & Response Contract
  console.log('\n📌 CHECKPOINT 5, 6, 7 & 8: Request Submission & AI Pipeline Execution');
  let createdRequestId = null;
  let responseData = null;

  try {
    const startTime = Date.now();
    const res = await fetch(`${BACKEND_URL}/api/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': FRONTEND_URL
      },
      body: JSON.stringify(TEST_DATA)
    });
    const elapsed = Date.now() - startTime;

    assert(res.status === 201, `POST /api/requests returned HTTP 201 Created (Got: ${res.status}) in ${elapsed}ms`);
    const json = await res.json();
    assert(json.success === true, 'Response contains success: true');
    assert(json.data && json.data.id, `Created Request ID present: ${json?.data?.id}`);

    responseData = json.data;
    createdRequestId = json.data.id;

    // Verify AI Pipeline
    assert(responseData.category === 'PLUMBING' || responseData.category === 'MAINTENANCE', `AI classified category: ${responseData.category}`);
    assert(responseData.priority === 'HIGH' || responseData.priority === 'CRITICAL' || responseData.priority === 'MEDIUM', `Priority assigned: ${responseData.priority}`);
    assert(responseData.department === 'Maintenance', `Department routed to: ${responseData.department}`);
    assert(typeof responseData.slaHours === 'number' && responseData.slaHours > 0, `SLA calculated: ${responseData.slaHours}h`);
    assert(responseData.dueAt && !isNaN(Date.parse(responseData.dueAt)), `Due At timestamp present: ${responseData.dueAt}`);
    assert(responseData.status === 'TRIAGED', `Initial Status is TRIAGED (Got: ${responseData.status})`);

    // Verify Notion Action Logs via Endpoint
    console.log('\n📌 CHECKPOINT 8: Action Logs Verification');
    const logsRes = await fetch(`${BACKEND_URL}/api/requests/${createdRequestId}/logs`);
    assert(logsRes.status === 200, `GET /api/requests/:id/logs returned HTTP 200 (Got: ${logsRes.status})`);
    const logsJson = await logsRes.json();
    const logs = logsJson.data || [];
    assert(logs.length > 0, `Action logs recorded for ${createdRequestId} (Found: ${logs.length})`);
    assert(logs.some(l => l.Action === 'REQUEST_CREATED'), 'Action logs include REQUEST_CREATED');
    assert(logs.some(l => l.Action === 'AI_ANALYZED'), 'Action logs include AI_ANALYZED');
    assert(logs.some(l => l.Action === 'PRIORITY_ASSIGNED'), 'Action logs include PRIORITY_ASSIGNED');
    assert(logs.some(l => l.Action === 'DEPARTMENT_ASSIGNED'), 'Action logs include DEPARTMENT_ASSIGNED');

  } catch (err) {
    assert(false, `Request submission / verification failed: ${err.message}`);
  }

  // TEST 9 & 10: Invalid Inputs & Error Safety
  console.log('\n📌 CHECKPOINT 9 & 10: Backend Error Handling & Validation Safety');
  try {
    // Missing required description
    const res1 = await fetch(`${BACKEND_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterName: 'Test Student',
        requesterEmail: 'test@example.com',
        location: 'Hostel Block B',
        description: '' // empty description
      })
    });
    assert(res1.status === 400, `Empty description rejected with HTTP 400 (Got: ${res1.status})`);
    const errJson1 = await res1.json();
    assert(errJson1.success === false, 'Error response has success: false');
    assert(typeof errJson1.message === 'string', `Safe error message returned: "${errJson1.message}"`);
    assert(!errJson1.message.includes('token') && !errJson1.message.includes('ntn_'), 'No sensitive tokens leaked in error');

    // Missing requesterName
    const res2 = await fetch(`${BACKEND_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterName: '',
        requesterEmail: 'test@example.com',
        location: 'Hostel Block B',
        description: 'Valid issue description here.'
      })
    });
    assert(res2.status === 400, `Empty requesterName rejected with HTTP 400 (Got: ${res2.status})`);

    // Invalid Email
    const res3 = await fetch(`${BACKEND_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterName: 'Test Student',
        requesterEmail: 'invalid-email-format',
        location: 'Hostel Block B',
        description: 'Valid issue description here.'
      })
    });
    assert(res3.status === 400, `Invalid email rejected with HTTP 400 (Got: ${res3.status})`);

  } catch (err) {
    assert(false, `Error handling tests failed: ${err.message}`);
  }

  // TEST 11: Duplicate Submission / Incident Linking Test
  console.log('\n📌 CHECKPOINT 11 & 12: Duplicate Submission & Incident Linking');
  try {
    const duplicateRes = await fetch(`${BACKEND_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_DATA) // exact same issue in same location
    });
    assert(duplicateRes.status === 201, `Duplicate submission handled gracefully (Got: ${duplicateRes.status})`);
    const dupJson = await duplicateRes.json();
    const dupData = dupJson.data;
    assert(dupData.id && dupData.id !== createdRequestId, `Duplicate created separate preserved ticket ID (${dupData.id})`);
    assert(dupData.incidentId && dupData.incidentId.startsWith('INC-'), `Duplicate assigned shared Incident ID: ${dupData.incidentId}`);
  } catch (err) {
    assert(false, `Duplicate submission test failed: ${err.message}`);
  }

  console.log('\n================================================================');
  console.log(`🏁 INTEGRATION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed === 0) {
    console.log('🎉 ALL INTEGRATION CHECKPOINTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED:', failures);
    process.exit(1);
  }
}

runTests();
