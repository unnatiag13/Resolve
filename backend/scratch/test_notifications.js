import { execSync } from 'child_process';

const baseUrl = 'http://localhost:5000';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runNotificationTests() {
  console.log('=============== STARTING PHASE 4.4 NOTIFICATION TESTS ===============\n');

  let ticketId = null;

  // 1. Create a request and verify REQUEST_CREATED triggers
  console.log('--to trigger REQUEST_CREATED notifications...');
  try {
    const res = await fetch(baseUrl + '/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterName: 'Notification Tester',
        requesterEmail: 'notif.tester@campus.edu',
        location: 'Lab 5',
        description: 'Test notification dispatching engine.'
      })
    });
    const json = await res.json();
    if (json.success) {
      ticketId = json.data.id;
      console.log(`   [SUCCESS] Created Request: ${ticketId}`);
    } else {
      console.log('   [FAIL]:', json.message);
      return;
    }
  } catch (e) {
    console.log('   [ERROR]:', e.message);
    return;
  }

  // Wait for Notion replication index sync
  console.log('   - Waiting 4 seconds for Notion database replication sync...');
  await sleep(4000);

  // 2. Transition request to ASSIGNED
  console.log(`\n---> Transitioning request ${ticketId} to ASSIGNED...`);
  try {
    const res = await fetch(`${baseUrl}/api/requests/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'ASSIGNED',
        assignedTo: 'Jane Doe'
      })
    });
    const json = await res.json();
    if (json.success) {
      console.log('   - Transition to ASSIGNED: SUCCESS');
    } else {
      console.log('   - Transition to ASSIGNED: FAILED:', json.message);
    }
  } catch (e) {
    console.log('   [ERROR]:', e.message);
  }

  // Wait for Notion replication index sync
  console.log('   - Waiting 4 seconds for Notion database replication sync...');
  await sleep(4000);

  // 3. Transition request to IN_PROGRESS (Intermediate step before RESOLVED)
  console.log(`\n---> Transitioning request ${ticketId} to IN_PROGRESS...`);
  try {
    const res = await fetch(`${baseUrl}/api/requests/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'IN_PROGRESS'
      })
    });
    const json = await res.json();
    if (json.success) {
      console.log('   - Transition to IN_PROGRESS: SUCCESS');
    } else {
      console.log('   - Transition to IN_PROGRESS: FAILED:', json.message);
    }
  } catch (e) {
    console.log('   [ERROR]:', e.message);
  }

  // Wait for Notion replication index sync
  console.log('   - Waiting 4 seconds for Notion database replication sync...');
  await sleep(4000);

  // 4. Transition request to RESOLVED with notes
  console.log(`\n---> Transitioning request ${ticketId} to RESOLVED...`);
  try {
    const res = await fetch(`${baseUrl}/api/requests/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'RESOLVED',
        resolution: 'Notification dispatch verified successfully across mock endpoints.'
      })
    });
    const json = await res.json();
    if (json.success) {
      console.log('   - Transition to RESOLVED: SUCCESS');
    } else {
      console.log('   - Transition to RESOLVED: FAILED:', json.message);
    }
  } catch (e) {
    console.log('   [ERROR]:', e.message);
  }

  // Wait for Notion replication index sync
  console.log('   - Waiting 4 seconds for Notion database replication sync...');
  await sleep(4000);

  // 5. Query Action Logs for this request and print them
  console.log(`\n---> Fetching Action Logs for request ${ticketId} to verify notification logs...`);
  try {
    const cmd = `node --env-file=.env -e "import('./services/notionService.js').then(async m => { const logs = await m.getActionLogs('${ticketId}'); console.log(JSON.stringify(logs.filter(l => l.Reason.includes('[Notification')), null, 2)); });"`;
    const output = execSync(cmd, { cwd: process.cwd() }).toString();
    console.log('   [LOGS RETRIEVED]:');
    console.log(output);

    const hasNotConfigured = output.includes('NOT_CONFIGURED');
    const hasSuccess = output.includes('SUCCESS');
    
    if (hasNotConfigured && hasSuccess) {
      console.log('   - Notification Logging and Result code verification: PASSED');
    } else {
      console.log('   - Notification Logging and Result code verification: FAILED');
    }
  } catch (e) {
    console.log('   [ERROR Retrieving Logs]:', e.message);
  }

  console.log('\n=============== PHASE 4.4 TESTING COMPLETED ===============');
}

runNotificationTests();
