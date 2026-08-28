/* test_phase4_7_master.js
   Master Test Suite for ResolveAI Phase 4.7 Complete Verification.
   Executes TEST 1 through TEST 10 against localhost:5000 backend server.
*/

const BASE_URL = 'http://localhost:5000';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Test assertion failed: ${message}`);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

(async () => {
  console.log('================================================================');
  console.log('🚀 RESOLVEAI PHASE 4.7 COMPLETE TESTING & VERIFICATION SUITE');
  console.log('================================================================\n');

  let parentReqId = null;
  let childReqId = null;
  let diffReqId = null;
  let incidentId = null;

  // -------------------------------------------------------------------
  // TEST 1 — New Request
  // -------------------------------------------------------------------
  console.log('📌 TEST 1 — New Request Lifecycle');
  try {
    const parentPayload = {
      requesterName: 'Alice Green',
      requesterEmail: 'alice.g@campus.edu',
      location: 'Hostel Block A Room 101',
      description: 'Air conditioner unit is not cooling and making loud humming noise'
    };

    const res = await fetch(`${BASE_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parentPayload)
    });

    assert(res.status === 201, `POST /api/requests returned HTTP 201 (Got ${res.status})`);
    const json = await res.json();
    assert(json.success === true, 'Response payload has success: true');
    
    const req = json.data;
    parentReqId = req.id;
    console.log(`   --> Created Request ID: ${parentReqId}`);

    assert(Boolean(req.id), 'Request ID generated successfully');
    assert(req.status === 'TRIAGED', 'Initial status is TRIAGED');
    assert(Boolean(req.category), `Category assigned: ${req.category}`);
    assert(Boolean(req.priority), `Priority assigned: ${req.priority}`);
    assert(Boolean(req.department), `Department mapped: ${req.department}`);
    assert(typeof req.slaHours === 'number', `SLA Hours calculated: ${req.slaHours}h`);
    assert(Boolean(req.dueAt), `Due At timestamp calculated: ${req.dueAt}`);
    
    // Verify Action Logs via HTTP API
    const logsRes = await fetch(`${BASE_URL}/api/requests/${parentReqId}/logs`);
    assert(logsRes.status === 200, 'GET /api/requests/:id/logs returned HTTP 200');
    const logsJson = await logsRes.json();
    const logs = logsJson.data;
    assert(logs.length > 0, `Action logs recorded for ${parentReqId} (Count: ${logs.length})`);
    const actions = logs.map(l => l['Action'] || l.action || l.ActionType);
    assert(actions.includes('REQUEST_CREATED'), 'Action Log includes REQUEST_CREATED');
    assert(actions.includes('AI_ANALYZED'), 'Action Log includes AI_ANALYZED');
    assert(actions.includes('PRIORITY_ASSIGNED'), 'Action Log includes PRIORITY_ASSIGNED');
    assert(actions.includes('DEPARTMENT_ASSIGNED'), 'Action Log includes DEPARTMENT_ASSIGNED');
    console.log('✅ TEST 1 PASSED SUCCESSFULLY.\n');
  } catch (err) {
    console.error('❌ TEST 1 FAILED:', err.message);
    process.exit(1);
  }

  // -------------------------------------------------------------------
  // TEST 2 — Duplicate Request
  // -------------------------------------------------------------------
  console.log('📌 TEST 2 — Duplicate Request Detection & Incident Linking');
  try {
    const dupPayload = {
      requesterName: 'Bob White',
      requesterEmail: 'bob.w@campus.edu',
      location: 'Hostel Block A Room 101',
      description: 'AC unit in room 101 is not cooling and making loud humming sound'
    };

    const res = await fetch(`${BASE_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dupPayload)
    });

    assert(res.status === 201, 'Duplicate POST /api/requests returned HTTP 201');
    const json = await res.json();
    const req = json.data;
    childReqId = req.id;
    incidentId = req.incidentId;

    console.log(`   --> Created Duplicate Request ID: ${childReqId}, Linked Incident ID: ${incidentId}`);
    assert(Boolean(childReqId), 'Duplicate request created and preserved');
    assert(Boolean(incidentId), 'Incident ID assigned to duplicate request');

    // Fetch parent to verify shared Incident ID
    const parentRes = await fetch(`${BASE_URL}/api/requests/${parentReqId}`);
    const parentData = (await parentRes.json()).data;
    const parentIncidentId = parentData['Incident ID'] || parentData.incidentId;
    console.log(`   --> Parent Request Incident ID: ${parentIncidentId}`);
    assert(parentIncidentId === incidentId, 'Parent and Duplicate requests share exact Incident ID');

    // Verify duplicate action logs via HTTP API
    const childLogsRes = await fetch(`${BASE_URL}/api/requests/${childReqId}/logs`);
    assert(childLogsRes.status === 200, 'GET duplicate request logs returned HTTP 200');
    const childLogs = (await childLogsRes.json()).data;
    const childActions = childLogs.map(l => l['Action'] || l.action || l.ActionType);
    assert(childActions.includes('AI_ANALYZED'), 'Duplicate request has AI_ANALYZED duplicate action log');
    console.log('✅ TEST 2 PASSED SUCCESSFULLY.\n');
  } catch (err) {
    console.error('❌ TEST 2 FAILED:', err.message);
    process.exit(1);
  }

  // -------------------------------------------------------------------
  // TEST 3 — Different Request
  // -------------------------------------------------------------------
  console.log('📌 TEST 3 — Different Request (Non-Duplicate Verification)');
  try {
    const diffPayload = {
      requesterName: 'Charlie Brown',
      requesterEmail: 'charlie.b@campus.edu',
      location: 'Academic Block 3 Room 202',
      description: 'Overhead projector bulb is flickering continuously'
    };

    const res = await fetch(`${BASE_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(diffPayload)
    });

    assert(res.status === 201, 'Different POST /api/requests returned HTTP 201');
    const json = await res.json();
    diffReqId = json.data.id;
    const diffIncId = json.data.incidentId;

    console.log(`   --> Created Independent Request ID: ${diffReqId}, Incident ID: ${diffIncId || 'None'}`);
    assert(diffIncId !== incidentId, 'Different request was NOT linked to the previous Incident ID');
    console.log('✅ TEST 3 PASSED SUCCESSFULLY.\n');
  } catch (err) {
    console.error('❌ TEST 3 FAILED:', err.message);
    process.exit(1);
  }

  // -------------------------------------------------------------------
  // TEST 4 — Resolution Suggestion
  // -------------------------------------------------------------------
  console.log('📌 TEST 4 — AI Resolution Suggestions');
  try {
    const res = await fetch(`${BASE_URL}/api/requests/${parentReqId}/suggestions`, {
      method: 'POST'
    });

    assert(res.status === 200, 'POST /api/requests/:id/suggestions returned HTTP 200');
    const json = await res.json();
    assert(json.success === true, 'Suggestions response indicates success');
    
    const sugg = json.data;
    assert(typeof sugg.summary === 'string' && sugg.summary.length > 0, 'Suggestions contain summary string');
    assert(Array.isArray(sugg.suggestedActions), 'Suggestions contain suggestedActions array');
    assert(typeof sugg.recommendedNextStep === 'string', 'Suggestions contain recommendedNextStep');
    assert(typeof sugg.urgencyNote === 'string', 'Suggestions contain urgencyNote');
    console.log(`   --> Suggestion Source: ${sugg.suggestionsSource}`);

    // Verify ticket status was NOT changed
    const parentFetch = await fetch(`${BASE_URL}/api/requests/${parentReqId}`);
    const currentStatus = (await parentFetch.json()).data.Status || (await parentFetch.json()).data.status;
    assert(currentStatus === 'TRIAGED' || currentStatus === 'IN_PROGRESS', 'Ticket status was not falsely resolved by AI suggestions');
    console.log('✅ TEST 4 PASSED SUCCESSFULLY.\n');
  } catch (err) {
    console.error('❌ TEST 4 FAILED:', err.message);
    process.exit(1);
  }

  // -------------------------------------------------------------------
  // TEST 5 — Status Workflow
  // -------------------------------------------------------------------
  console.log('📌 TEST 5 — Status Workflow & Invalid Transition Checks');
  try {
    // Valid transitions: TRIAGED -> ASSIGNED -> IN_PROGRESS
    const assignRes = await fetch(`${BASE_URL}/api/requests/${parentReqId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ASSIGNED', assignedTo: 'HVAC Team A' })
    });
    assert(assignRes.status === 200, 'Valid transition TRIAGED -> ASSIGNED succeeded');

    const progressRes = await fetch(`${BASE_URL}/api/requests/${parentReqId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' })
    });
    assert(progressRes.status === 200, 'Valid transition ASSIGNED -> IN_PROGRESS succeeded');

    // Invalid transition: TRIAGED -> CLOSED on diffReqId
    const invalidRes = await fetch(`${BASE_URL}/api/requests/${diffReqId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });
    assert(invalidRes.status === 400, `Invalid status transition TRIAGED -> CLOSED rejected with HTTP 400 (Got ${invalidRes.status})`);
    console.log('✅ TEST 5 PASSED SUCCESSFULLY.\n');
  } catch (err) {
    console.error('❌ TEST 5 FAILED:', err.message);
    process.exit(1);
  }

  // -------------------------------------------------------------------
  // TEST 6 — Resolution
  // -------------------------------------------------------------------
  console.log('📌 TEST 6 — Resolution Validation & Notes Enforcement');
  try {
    // Attempt RESOLVED without resolution text
    const badResolve = await fetch(`${BASE_URL}/api/requests/${parentReqId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RESOLVED', resolution: '' })
    });
    assert(badResolve.status === 400, 'Resolving without resolution notes rejected with HTTP 400');

    // Supply resolution text
    const goodResolve = await fetch(`${BASE_URL}/api/requests/${parentReqId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'RESOLVED',
        resolution: 'Cleared AC drain pipe obstruction and recharged refrigerant liquid.',
        performedBy: 'HVAC Team A'
      })
    });
    assert(goodResolve.status === 200, 'Resolving with valid resolution text returned HTTP 200');
    const resData = (await goodResolve.json()).data;
    assert((resData.Status || resData.status) === 'RESOLVED', 'Ticket status updated to RESOLVED');
    assert(Boolean(resData['Resolved At'] || resData.resolvedAt), 'Resolved At timestamp stored');

    // Check Action Logs via HTTP API
    const resolveLogsRes = await fetch(`${BASE_URL}/api/requests/${parentReqId}/logs`);
    const resolveLogs = (await resolveLogsRes.json()).data;
    const resolveActions = resolveLogs.map(l => l['Action'] || l.action || l.ActionType);
    assert(resolveActions.includes('RESOLVED'), 'Action Log includes RESOLVED entry');
    console.log('✅ TEST 6 PASSED SUCCESSFULLY.\n');
  } catch (err) {
    console.error('❌ TEST 6 FAILED:', err.message);
    process.exit(1);
  }

  // -------------------------------------------------------------------
  // TEST 7 — Verification & Closure
  // -------------------------------------------------------------------
  console.log('📌 TEST 7 — Verification, Closure & Monitoring Exclusion');
  try {
    // RESOLVED -> VERIFIED -> CLOSED
    const vRes = await fetch(`${BASE_URL}/api/requests/${parentReqId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'VERIFIED' })
    });
    assert(vRes.status === 200, 'Transition RESOLVED -> VERIFIED succeeded');

    const cRes = await fetch(`${BASE_URL}/api/requests/${parentReqId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });
    assert(cRes.status === 200, 'Transition VERIFIED -> CLOSED succeeded');

    // Verify CLOSED ticket rejects updates (CLOSED -> IN_PROGRESS)
    const closedUpdate = await fetch(`${BASE_URL}/api/requests/${parentReqId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' })
    });
    assert(closedUpdate.status === 400, 'Transition CLOSED -> IN_PROGRESS rejected with HTTP 400');

    // Verify CLOSED ticket excluded from active monitoring list
    const activeReqsRes = await fetch(`${BASE_URL}/api/monitoring/requests?state=NORMAL`);
    const activeReqs = (await activeReqsRes.json()).data;
    const closedFound = activeReqs.some(r => r.id === parentReqId);
    assert(closedFound === false, 'CLOSED request is excluded from active SLA monitoring');
    console.log('✅ TEST 7 PASSED SUCCESSFULLY.\n');
  } catch (err) {
    console.error('❌ TEST 7 FAILED:', err.message);
    process.exit(1);
  }

  // -------------------------------------------------------------------
  // TEST 8 — SLA Monitoring & Deduplication
  // -------------------------------------------------------------------
  console.log('📌 TEST 8 — SLA Monitoring & Alert Deduplication');
  try {
    // Run SLA monitor cycle
    const mon1 = await fetch(`${BASE_URL}/api/sla/monitor`);
    assert(mon1.status === 200, 'SLA Monitor cycle 1 executed with HTTP 200');
    const mon1Data = (await mon1.json()).data;
    console.log(`   --> Cycle 1 Checked: ${mon1Data.totalChecked}, Reminders: ${mon1Data.triggeredRemindersThisCycle}, Breaches: ${mon1Data.processedBreachesThisCycle}, Escalations: ${mon1Data.processedEscalationsThisCycle}`);

    // Immediately re-run SLA monitor cycle to test deduplication
    const mon2 = await fetch(`${BASE_URL}/api/sla/monitor`);
    assert(mon2.status === 200, 'SLA Monitor cycle 2 executed with HTTP 200');
    const mon2Data = (await mon2.json()).data;
    console.log(`   --> Cycle 2 Reminders: ${mon2Data.triggeredRemindersThisCycle}, Breaches: ${mon2Data.processedBreachesThisCycle}, Escalations: ${mon2Data.processedEscalationsThisCycle}`);
    
    assert(mon2Data.triggeredRemindersThisCycle === 0, 'No duplicate reminders triggered in second cycle');
    assert(mon2Data.processedEscalationsThisCycle === 0, 'No duplicate escalations processed in second cycle');
    console.log('✅ TEST 8 PASSED SUCCESSFULLY.\n');
  } catch (err) {
    console.error('❌ TEST 8 FAILED:', err.message);
    process.exit(1);
  }

  // -------------------------------------------------------------------
  // TEST 9 — Department APIs
  // -------------------------------------------------------------------
  console.log('📌 TEST 9 — Department Overview & Requests API');
  try {
    const listDepts = await fetch(`${BASE_URL}/api/departments`);
    assert(listDepts.status === 200, 'GET /api/departments returned HTTP 200');

    const deptReqs = await fetch(`${BASE_URL}/api/departments/DEPT-MAINT/requests`);
    assert(deptReqs.status === 200, 'GET /api/departments/DEPT-MAINT/requests returned HTTP 200');
    const deptReqsJson = await deptReqs.json();
    assert(deptReqsJson.success === true && Array.isArray(deptReqsJson.data), 'Department requests returned data array');

    const deptOverview = await fetch(`${BASE_URL}/api/departments/DEPT-MAINT/overview`);
    assert(deptOverview.status === 200, 'GET /api/departments/DEPT-MAINT/overview returned HTTP 200');
    const overviewJson = await deptOverview.json();
    assert(overviewJson.success === true && typeof overviewJson.data.total === 'number', 'Department overview returned structured metrics');
    console.log(`   --> Maintenance Total: ${overviewJson.data.total}, Breached: ${overviewJson.data.slaBreachedCount}`);
    console.log('✅ TEST 9 PASSED SUCCESSFULLY.\n');
  } catch (err) {
    console.error('❌ TEST 9 FAILED:', err.message);
    process.exit(1);
  }

  // -------------------------------------------------------------------
  // TEST 10 — Regression Testing & Phase 4 Endpoints
  // -------------------------------------------------------------------
  console.log('📌 TEST 10 — Regression & Endpoint Verification');
  try {
    const endpoints = [
      { name: 'GET /health', url: `${BASE_URL}/health`, method: 'GET' },
      { name: 'GET /api/requests', url: `${BASE_URL}/api/requests`, method: 'GET' },
      { name: `GET /api/requests/${childReqId}`, url: `${BASE_URL}/api/requests/${childReqId}`, method: 'GET' },
      { name: 'GET /api/analytics/overview', url: `${BASE_URL}/api/analytics/overview`, method: 'GET' },
      { name: 'GET /api/monitoring/overview', url: `${BASE_URL}/api/monitoring/overview`, method: 'GET' },
      { name: 'GET /api/monitoring/requests?state=NORMAL', url: `${BASE_URL}/api/monitoring/requests?state=NORMAL`, method: 'GET' },
      { name: 'GET /api/monitoring/requests?state=WARNING', url: `${BASE_URL}/api/monitoring/requests?state=WARNING`, method: 'GET' },
      { name: 'GET /api/monitoring/requests?state=BREACHED', url: `${BASE_URL}/api/monitoring/requests?state=BREACHED`, method: 'GET' },
      { name: 'GET /api/test-gemini', url: `${BASE_URL}/api/test-gemini`, method: 'GET' }
    ];

    for (const ep of endpoints) {
      const res = await fetch(ep.url, { method: ep.method });
      if (ep.name === 'GET /api/test-gemini') {
        const json = await res.json();
        assert(res.status === 200 || res.status === 500, `GET /api/test-gemini returned valid diagnostic status ${res.status}`);
        assert(typeof json.success === 'boolean', 'GET /api/test-gemini returned diagnostic JSON structure');
      } else {
        assert(res.status < 500, `${ep.name} returned non-500 status (Got ${res.status})`);
      }
    }

    // Test POST /api/analyze-ai
    const analyzeRes = await fetch(`${BASE_URL}/api/analyze-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Washroom tap is leaking water continuously', location: 'Library' })
    });
    assert(analyzeRes.status === 200, 'POST /api/analyze-ai returned HTTP 200');
    const analyzeJson = await analyzeRes.json();
    assert(analyzeJson.success === true && Boolean(analyzeJson.data.category), 'POST /api/analyze-ai returned analysis');

    console.log('✅ TEST 10 PASSED SUCCESSFULLY.\n');
  } catch (err) {
    console.error('❌ TEST 10 FAILED:', err.message);
    process.exit(1);
  }

  console.log('================================================================');
  console.log('🎉 ALL 10 TEST SUITES PASSED SUCCESSFULLY WITH 0 FAILURES!');
  console.log('================================================================');
})();
