const baseUrl = 'http://localhost:5000';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runDuplicateTests() {
  console.log('=============== STARTING PHASE 4.3 DUPLICATE DETECTION TESTS ===============\n');

  // Use unique names with underscores instead of hyphens to avoid splitting timestamps into separate tokens
  const testId = Date.now();
  const uniqueLocation = `ZoneA999_${testId}`;
  const uniqueLibraryLocation = `ZoneC777_${testId + 1000}`;

  let ticketA_Id = null;
  let ticketA_IncId = null;

  // 1. Create Ticket A (New Incident)
  console.log(`---> Creating Ticket A at location: "${uniqueLocation}"`);
  try {
    const res = await fetch(baseUrl + '/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterName: 'Alice J',
        requesterEmail: 'alice.j@campus.edu',
        location: uniqueLocation,
        description: 'Fitted faucet leak in bathroom.'
      })
    });
    const json = await res.json();
    if (json.success) {
      ticketA_Id = json.data.id;
      ticketA_IncId = json.data.incidentId;
      console.log(`   [SUCCESS] Created Request: ${ticketA_Id} | Incident ID on creation: "${ticketA_IncId || 'None (correct)'}"`);
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

  // 2. Create Ticket B (Duplicate of Ticket A)
  console.log(`\n---> Creating Ticket B at similar location: "${uniqueLocation}" (Duplicate Check)`);
  try {
    const res = await fetch(baseUrl + '/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterName: 'Bob K',
        requesterEmail: 'bob.k@campus.edu',
        location: uniqueLocation,
        description: 'Faucet leak in the bathroom.'
      })
    });
    const json = await res.json();
    if (json.success) {
      const ticketB_Id = json.data.id;
      const ticketB_IncId = json.data.incidentId;
      console.log(`   [SUCCESS] Created Request: ${ticketB_Id}`);
      console.log(`   - Linked Incident ID: "${ticketB_IncId}"`);

      // Wait a moment for B update to sync, then fetch parent A status
      console.log('   - Waiting 4 seconds for parent ticket update to replicate...');
      await sleep(4000);

      const verifyRes = await fetch(`${baseUrl}/api/requests/${ticketA_Id}`);
      const verifyJson = await verifyRes.json();
      ticketA_IncId = verifyJson.data['Incident ID'] || verifyJson.data.incidentId;
      console.log(`   - Parent Request (${ticketA_Id}) Incident ID: "${ticketA_IncId}"`);

      const idsMatch = ticketB_IncId && ticketA_IncId && ticketB_IncId === ticketA_IncId;
      console.log('   - Duplicate Detection and Incident Linking:', idsMatch ? 'PASSED' : 'FAILED');
    } else {
      console.log('   [FAIL]:', json.message);
    }
  } catch (e) {
    console.log('   [ERROR]:', e.message);
  }

  // 3. Create Ticket C (Different issue - Non-duplicate)
  console.log(`\n---> Creating Ticket C at location: "${uniqueLibraryLocation}" (Non-duplicate Check)`);
  try {
    const res = await fetch(baseUrl + '/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterName: 'Charlie L',
        requesterEmail: 'charlie.l@campus.edu',
        location: uniqueLibraryLocation,
        description: 'Fitted router is offline.'
      })
    });
    const json = await res.json();
    if (json.success) {
      const ticketC_Id = json.data.id;
      const ticketC_IncId = json.data.incidentId;
      console.log(`   [SUCCESS] Created Request: ${ticketC_Id} | Incident ID: "${ticketC_IncId || 'None (correct)'}"`);
      console.log('   - Non-duplicate isolation check:', !ticketC_IncId ? 'PASSED' : 'FAILED');
    } else {
      console.log('   [FAIL]:', json.message);
    }
  } catch (e) {
    console.log('   [ERROR]:', e.message);
  }

  console.log('\n=============== PHASE 4.3 TESTING COMPLETED ===============');
}

runDuplicateTests();
