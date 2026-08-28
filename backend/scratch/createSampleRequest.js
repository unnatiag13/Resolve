/* createSampleRequest.js
   Quick script to POST a mock request to the ResolveAI backend.
   Run with: node backend/scratch/createSampleRequest.js
*/

const payload = {
  description: "Water supply stopped in Block B hostel",
  requesterName: "Alice",
  requesterEmail: "alice@example.com",
  location: "Hostel Block B",
  category: "INFRASTRUCTURE",
  subcategory: "PLUMBING",
  priority: "HIGH",
  department: "DEPT-MAINT",
  status: "NEW"
};

(async () => {
  try {
    const port = process.env.PORT || 5000;
    const url = `http://localhost:${port}/api/requests`;
    console.log('Posting to', url);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    console.log("Response status:", response.status);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error posting request:", err);
  }
})();
