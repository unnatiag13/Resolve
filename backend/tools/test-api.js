// Set environment variable to run using in-memory mock Notion database
process.env.MOCK_NOTION = 'true';

// Import app from app.js (decoupled from the main server port 5000 listener)
import app from '../app.js';

const PORT = 5001; // Run test server on a separate port to avoid EADDRINUSE
const BASE_URL = `http://localhost:${PORT}`;

// Start the server programmatically for testing
const server = app.listen(PORT, () => {
  console.log(`ResolveAI test server is running on port ${PORT}`);
});

async function runTests() {
  console.log('=== STARTING RESOLVEAI BACKEND PHASE 1 INTEGRATION TESTS ===');
  let failures = 0;

  // Helper to assert conditions
  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      failures++;
    } else {
      console.log(`✅ PASS: ${message}`);
    }
  }

  try {
    // Wait briefly for server to boot
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test 1: Healthcheck Endpoint
    console.log('\n--- Test 1: GET /health ---');
    const healthRes = await fetch(`${BASE_URL}/health`);
    assert(healthRes.status === 200, 'Health endpoint status is 200');
    const healthData = await healthRes.json();
    assert(healthData.success === true, 'Health check response is successful');
    assert(healthData.timestamp !== undefined, 'Health check contains timestamp');

    // Test 2: Create Request with valid data
    console.log('\n--- Test 2: POST /api/requests (Valid Request) ---');
    const requestPayload = {
      requesterName: 'Test Student',
      requesterEmail: 'test@example.com',
      location: 'Hostel Block B',
      description: 'There is no water in Hostel Block B.'
    };
    const postRes = await fetch(`${BASE_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload)
    });
    assert(postRes.status === 201, 'Create request status is 201');
    const postData = await postRes.json();
    assert(postData.success === true, 'Response indicates success');
    assert(postData.data.id === 'REQ-0001', 'First Request ID is REQ-0001');
    assert(postData.data.category === 'PLUMBING', 'Category is set to PLUMBING');
    assert(postData.data.priority === 'HIGH', 'Priority is set to HIGH');
    assert(postData.data.slaHours === 12, 'SLA Hours is set to 12');
    assert(postData.data.status === 'TRIAGED', 'Status is set to TRIAGED');
    assert(postData.data.dueAt !== undefined, 'Due At date is calculated');

    // Test 3: Create Request with invalid data (validation check)
    console.log('\n--- Test 3: POST /api/requests (Invalid/Missing Field) ---');
    const invalidPayload = {
      requesterName: 'Test Student',
      location: 'Hostel Block B',
      description: 'There is no water in Hostel Block B.'
      // Missing Email
    };
    const invalidRes = await fetch(`${BASE_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload)
    });
    assert(invalidRes.status === 400, 'Invalid request results in status 400');
    const invalidData = await invalidRes.json();
    assert(invalidData.success === false, 'success is false');
    assert(invalidData.message.includes('email'), 'Error message mentions missing email');

    // Test 4: List all Requests
    console.log('\n--- Test 4: GET /api/requests ---');
    const listRes = await fetch(`${BASE_URL}/api/requests`);
    assert(listRes.status === 200, 'List requests status is 200');
    const listData = await listRes.json();
    assert(listData.success === true, 'List response indicates success');
    assert(listData.count === 1, 'Contains exactly 1 request');
    assert(listData.data[0]['Request ID'] === 'REQ-0001', 'First element has Request ID REQ-0001');

    // Test 5: Fetch Specific Request by ID
    console.log('\n--- Test 5: GET /api/requests/REQ-0001 ---');
    const getRes = await fetch(`${BASE_URL}/api/requests/REQ-0001`);
    assert(getRes.status === 200, 'Get request by ID status is 200');
    const getData = await getRes.json();
    assert(getData.success === true, 'Get response indicates success');
    assert(getData.data['Request ID'] === 'REQ-0001', 'Returned item matches queried ID');

    // Test 6: Fetch Non-existent Request
    console.log('\n--- Test 6: GET /api/requests/REQ-9999 (Non-existent) ---');
    const getNoneRes = await fetch(`${BASE_URL}/api/requests/REQ-9999`);
    assert(getNoneRes.status === 404, 'Non-existent request status is 404');
    const getNoneData = await getNoneRes.json();
    assert(getNoneData.success === false, 'success is false');
    assert(getNoneData.message.includes('not found'), 'Message contains "not found"');

    // Test 7: Update Request Status & Assignee
    console.log('\n--- Test 7: PATCH /api/requests/REQ-0001 ---');
    const patchPayload = {
      status: 'ASSIGNED',
      assignedTo: 'Plumber John',
      resolution: 'Inspected lines'
    };
    const patchRes = await fetch(`${BASE_URL}/api/requests/REQ-0001`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchPayload)
    });
    assert(patchRes.status === 200, 'Update request status is 200');
    const patchData = await patchRes.json();
    assert(patchData.success === true, 'Update response indicates success');
    assert(patchData.data.Status === 'ASSIGNED', 'Status updated to ASSIGNED');
    assert(patchData.data['Assigned To'] === 'Plumber John', 'Assigned To updated');
    assert(patchData.data.Resolution === 'Inspected lines', 'Resolution updated');

    // Test 8: Get Overview Analytics
    console.log('\n--- Test 8: GET /api/analytics/overview ---');
    const analyticsRes = await fetch(`${BASE_URL}/api/analytics/overview`);
    assert(analyticsRes.status === 200, 'Analytics endpoint status is 200');
    const analyticsData = await analyticsRes.json();
    assert(analyticsData.success === true, 'Analytics response indicates success');
    assert(analyticsData.data.total === 1, 'Total requests count is 1');
    assert(analyticsData.data.byStatus.ASSIGNED === 1, '1 request is in ASSIGNED status');
    assert(analyticsData.data.byPriority.HIGH === 1, '1 request is in HIGH priority');

    console.log('\n=== TEST RUN SUMMARY ===');
    if (failures === 0) {
      console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! Phase 1 backend works perfectly.');
      process.exit(0);
    } else {
      console.error(`❌ TEST RUN FAILED with ${failures} assertion failure(s).`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution threw an uncaught exception:', error);
    process.exit(1);
  }
}

runTests();
