const baseUrl = 'http://localhost:5000';

async function runPhase2Tests() {
  console.log('=============== STARTING PHASE 2.7 VERIFICATION SUITE ===============\n');

  const testRequests = [
    {
      name: '1. Plumbing (Water Outage)',
      body: { requesterName: 'Anil Kumar', requesterEmail: 'anil.k@campus.edu', location: 'Hostel Block B', description: 'There has been no water in Hostel Block B since morning and students cannot use the bathrooms.' }
    },
    {
      name: '2. Electrical Hazard (Sparking & Burning Smell)',
      body: { requesterName: 'Pooja Hegde', requesterEmail: 'pooja.h@campus.edu', location: 'Hostel Block C, Room 102', description: 'A socket near my bed is sparking and there is a burning smell.' }
    },
    {
      name: '3. IT (WiFi Down Before Exam)',
      body: { requesterName: 'Karan Johar', requesterEmail: 'karan.j@campus.edu', location: 'Central Library', description: 'The WiFi in the library has completely stopped working and I have an online exam.' }
    },
    {
      name: '4. Accounts (Fee Pending)',
      body: { requesterName: 'Siddharth Roy', requesterEmail: 'siddharth.r@campus.edu', location: 'Main Campus', description: 'I paid my semester fee last week but it is still showing pending.' }
    },
    {
      name: '5. Document (Bonafide Certificate)',
      body: { requesterName: 'Neha Sharma', requesterEmail: 'neha.s@campus.edu', location: 'Admin Block', description: 'I need a bonafide certificate for my internship.' }
    },
    {
      name: '6. Academic (Marks Not Updated)',
      body: { requesterName: 'Rahul Dravid', requesterEmail: 'rahul.d@campus.edu', location: 'Academic Office', description: 'My internal marks have not been updated.' }
    },
    {
      name: '7. Security (Intruder Hazard)',
      body: { requesterName: 'Tanvi Shah', requesterEmail: 'tanvi.s@campus.edu', location: 'Hostel Block A, 3rd Floor', description: 'An unknown person is repeatedly entering our hostel floor.' }
    },
    {
      name: '8. Gemini Failure Simulation (Fallback Mode)',
      body: { requesterName: 'Fallback Tester', requesterEmail: 'fallback@campus.edu', location: 'Hostel Block A', description: 'The water tap in the washroom is leaking.', forceFallback: true }
    }
  ];

  let createdIds = [];

  for (const t of testRequests) {
    console.log('---> Running Test:', t.name);
    try {
      const res = await fetch(baseUrl + '/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(t.body)
      });
      const json = await res.json();
      if (json.success) {
        console.log('   [SUCCESS] Created Request:', json.data.id);
        console.log('   - Category:', json.data.category, '| Subcategory:', json.data.subcategory);
        console.log('   - Priority:', json.data.priority, '| Reason:', json.data.priorityReason);
        console.log('   - Department:', json.data.department, '| SLA Hours:', json.data.slaHours);
        console.log('   - Due At:', json.data.dueAt);
        console.log('   - Analysis Source:', json.data.analysisSource);
        createdIds.push(json.data.id);
      } else {
        console.log('   [FAIL]:', json.message);
      }
    } catch (e) {
      console.log('   [ERROR]:', e.message);
    }
    console.log('\n');
  }

  console.log('=============== RUNNING REGRESSION TESTS ===============\n');

  // 1. GET /health
  try {
    const res = await fetch(baseUrl + '/health');
    const json = await res.json();
    console.log('1. GET /health:', json.success ? 'PASSED' : 'FAILED');
  } catch (e) { console.log('1. GET /health ERROR:', e.message); }

  // 2. GET /api/requests
  try {
    const res = await fetch(baseUrl + '/api/requests');
    const json = await res.json();
    console.log('2. GET /api/requests:', json.success ? `PASSED (${json.count} requests retrieved)` : 'FAILED');
  } catch (e) { console.log('2. GET /api/requests ERROR:', e.message); }

  // 3. GET /api/requests/:id
  const targetId = createdIds[0] || 'REQ-0001';
  try {
    const res = await fetch(baseUrl + '/api/requests/' + targetId);
    const json = await res.json();
    console.log('3. GET /api/requests/' + targetId + ':', json.success ? 'PASSED' : 'FAILED');
  } catch (e) { console.log('3. GET /api/requests/' + targetId + ' ERROR:', e.message); }

  // 4. PATCH /api/requests/:id
  try {
    const res = await fetch(baseUrl + '/api/requests/' + targetId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RESOLVED', resolution: 'Verified resolution in testing' })
    });
    const json = await res.json();
    console.log('4. PATCH /api/requests/' + targetId + ':', json.success ? 'PASSED' : 'FAILED');
  } catch (e) { console.log('4. PATCH /api/requests/' + targetId + ' ERROR:', e.message); }

  // 5. GET /api/analytics/overview
  try {
    const res = await fetch(baseUrl + '/api/analytics/overview');
    const json = await res.json();
    console.log('5. GET /api/analytics/overview:', json.success ? 'PASSED' : 'FAILED');
  } catch (e) { console.log('5. GET /api/analytics/overview ERROR:', e.message); }

  console.log('\n=============== PHASE 2.7 TESTING COMPLETED ===============');
}

runPhase2Tests();
