const baseUrl = 'http://localhost:5000';

async function runPhase4Tests() {
  console.log('=============== STARTING PHASE 4.1 RESOLUTION WORKFLOW TESTS ===============\n');

  let ticketId = null;

  // 1. Create a NEW ticket for testing status transitions
  try {
    const res = await fetch(baseUrl + '/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterName: 'Workflow Tester',
        requesterEmail: 'workflow.t@campus.edu',
        location: 'Lab 2',
        description: 'Testing control transitions and resolution workflows.'
      })
    });
    const json = await res.json();
    if (json.success) {
      ticketId = json.data.id;
      console.log(`[SETUP] Created test request ${ticketId} in status: ${json.data.status}`);
    } else {
      console.log('[SETUP FAIL]: Unable to create request:', json.message);
      return;
    }
  } catch (e) {
    console.log('[SETUP ERROR]:', e.message);
    return;
  }

  // TEST 1: Invalid status transition (NEW -> CLOSED) should fail
  console.log('\n---> TEST 1: Invalid Transition (NEW -> CLOSED)');
  try {
    const res = await fetch(`${baseUrl}/api/requests/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });
    const json = await res.json();
    console.log(`   - Status code: ${res.status} (Expected: 400)`);
    console.log(`   - Response Message: "${json.message}"`);
    console.log('   - Transition blocked successfully:', res.status === 400 && !json.success ? 'PASSED' : 'FAILED');
  } catch (e) {
    console.log('   [ERROR]:', e.message);
  }

  // TEST 2: Valid transitions (NEW -> TRIAGED -> ASSIGNED -> IN_PROGRESS)
  console.log('\n---> TEST 2: Valid Workflow Chain (NEW -> TRIAGED -> ASSIGNED -> IN_PROGRESS)');
  try {
    // NEW -> TRIAGED
    const res1 = await fetch(`${baseUrl}/api/requests/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'TRIAGED' })
    });
    const json1 = await res1.json();
    console.log(`   - NEW -> TRIAGED:`, json1.success ? 'PASSED' : 'FAILED');

    // TRIAGED -> ASSIGNED
    const res2 = await fetch(`${baseUrl}/api/requests/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ASSIGNED', assignedTo: 'John Doe' })
    });
    const json2 = await res2.json();
    console.log(`   - TRIAGED -> ASSIGNED:`, json2.success ? 'PASSED' : 'FAILED');

    // ASSIGNED -> IN_PROGRESS
    const res3 = await fetch(`${baseUrl}/api/requests/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' })
    });
    const json3 = await res3.json();
    console.log(`   - ASSIGNED -> IN_PROGRESS:`, json3.success ? 'PASSED' : 'FAILED');
  } catch (e) {
    console.log('   [ERROR]:', e.message);
  }

  // TEST 3: Resolution validation (IN_PROGRESS -> RESOLVED without notes should fail)
  console.log('\n---> TEST 3: Move to RESOLVED without resolution notes');
  try {
    const res = await fetch(`${baseUrl}/api/requests/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RESOLVED' })
    });
    const json = await res.json();
    console.log(`   - Status code: ${res.status} (Expected: 400)`);
    console.log(`   - Response Message: "${json.message}"`);
    console.log('   - Transition blocked successfully:', res.status === 400 && !json.success ? 'PASSED' : 'FAILED');
  } catch (e) {
    console.log('   [ERROR]:', e.message);
  }

  // TEST 4: Move to RESOLVED with notes should succeed and set Resolved At
  console.log('\n---> TEST 4: Move to RESOLVED with resolution notes');
  try {
    const res = await fetch(`${baseUrl}/api/requests/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'RESOLVED',
        resolution: 'Verified workflow transitions and resolution parameters.'
      })
    });
    const json = await res.json();
    if (json.success) {
      console.log('   - Transition to RESOLVED: PASSED');
      console.log(`   - Resolved At field present:`, json.data['Resolved At'] || json.data.resolvedAt ? 'PASSED' : 'FAILED');
      console.log(`     Resolved At Value: "${json.data['Resolved At'] || json.data.resolvedAt}"`);
    } else {
      console.log('   - Transition to RESOLVED: FAILED:', json.message);
    }
  } catch (e) {
    console.log('   [ERROR]:', e.message);
  }

  // TEST 5: Verify status transition to VERIFIED then CLOSED
  console.log('\n---> TEST 5: Walkthrough RESOLVED -> VERIFIED -> CLOSED');
  try {
    // RESOLVED -> VERIFIED
    const res1 = await fetch(`${baseUrl}/api/requests/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'VERIFIED' })
    });
    const json1 = await res1.json();
    console.log(`   - RESOLVED -> VERIFIED:`, json1.success ? 'PASSED' : 'FAILED');

    // VERIFIED -> CLOSED
    const res2 = await fetch(`${baseUrl}/api/requests/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });
    const json2 = await res2.json();
    console.log(`   - VERIFIED -> CLOSED:`, json2.success ? 'PASSED' : 'FAILED');
  } catch (e) {
    console.log('   [ERROR]:', e.message);
  }

  // TEST 6: Prevent updates to CLOSED requests
  console.log('\n---> TEST 6: Modify CLOSED Request (CLOSED -> IN_PROGRESS should fail)');
  try {
    const res = await fetch(`${baseUrl}/api/requests/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' })
    });
    const json = await res.json();
    console.log(`   - Status code: ${res.status} (Expected: 400)`);
    console.log(`   - Response Message: "${json.message}"`);
    console.log('   - Modifying closed request blocked successfully:', res.status === 400 && !json.success ? 'PASSED' : 'FAILED');
  } catch (e) {
    console.log('   [ERROR]:', e.message);
  }

  console.log('\n=============== PHASE 4.1 TESTING COMPLETED ===============');
}

runPhase4Tests();
