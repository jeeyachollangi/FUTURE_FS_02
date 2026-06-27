const { spawn } = require('child_process');
const path = require('path');

// We'll run the server on port 3002 for testing
const TEST_PORT = 3002;
const BASE_URL = `http://localhost:${TEST_PORT}`;

async function runTests() {
  console.log('🔄 Starting Mini CRM Integration Tests...');
  
  // 1. Spawn the Express server as a child process
  const serverProcess = spawn('node', [path.join(__dirname, 'server.js')], {
    env: {
      ...process.env,
      PORT: TEST_PORT,
      JWT_SECRET: 'test-secret-key-123456789'
    }
  });

  // Keep track of whether server started
  let serverStarted = false;
  let testFailed = false;

  // Set a timeout to kill the test if it hangs
  const timeoutTimer = setTimeout(() => {
    console.error('❌ Test Timeout: Server took too long to start or tests hung.');
    serverProcess.kill();
    process.exit(1);
  }, 20000);

  // Monitor server logs to wait for startup confirmation
  serverProcess.stdout.on('data', async (data) => {
    const output = data.toString();
    console.log(`[Server stdout] ${output.trim()}`);

    if (output.includes('Mini CRM Server is running') && !serverStarted) {
      serverStarted = true;
      try {
        await executeAPITests();
        console.log('\n✅ All integration tests passed successfully!');
      } catch (err) {
        console.error('\n❌ Integration tests failed:', err.message);
        testFailed = true;
      } finally {
        // Clean up
        clearTimeout(timeoutTimer);
        serverProcess.kill();
      }
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server stderr] ${data.toString()}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`ℹ️ Server process exited with code ${code}`);
    process.exit(testFailed ? 1 : 0);
  });
}

// Actual test runner
async function executeAPITests() {
  let adminToken = null;
  let createdLeadId = null;

  // ----------------------------------------------------
  // TEST 1: Submit public lead form
  // ----------------------------------------------------
  console.log('\n--- Running Test 1: Submit Public Lead Form ---');
  const leadPayload = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+1 (555) 987-6543',
    company: 'Innovate Labs',
    source: 'Social Media',
    message: 'We want a modern rebranding.'
  };

  const leadRes = await fetch(`${BASE_URL}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(leadPayload)
  });

  if (leadRes.status !== 201) {
    throw new Error(`Submit lead failed with status ${leadRes.status}`);
  }

  const leadData = await leadRes.json();
  if (!leadData.success || !leadData.leadId) {
    throw new Error('Submit lead response missing success or leadId fields');
  }
  createdLeadId = leadData.leadId;
  console.log(`🎉 Lead submitted successfully. Generated ID: ${createdLeadId}`);

  // ----------------------------------------------------
  // TEST 2: Admin Login - Failure
  // ----------------------------------------------------
  console.log('\n--- Running Test 2: Admin Login with Wrong Password ---');
  const loginFailRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
  });

  if (loginFailRes.status === 200) {
    throw new Error('Login with incorrect password succeeded when it should fail');
  }
  console.log('🎉 Login rejected as expected.');

  // ----------------------------------------------------
  // TEST 3: Admin Login - Success
  // ----------------------------------------------------
  console.log('\n--- Running Test 3: Admin Login with Correct Credentials ---');
  const loginSuccessRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });

  if (loginSuccessRes.status !== 200) {
    throw new Error(`Login failed with status ${loginSuccessRes.status}`);
  }

  const loginData = await loginSuccessRes.json();
  if (!loginData.success || !loginData.token) {
    throw new Error('Login response missing JWT token');
  }
  adminToken = loginData.token;
  console.log('🎉 Login authorized. Received JWT Token.');

  // Helper auth headers
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  };

  // ----------------------------------------------------
  // TEST 4: Get Leads List (Protected)
  // ----------------------------------------------------
  console.log('\n--- Running Test 4: Fetch Leads List (Authenticated) ---');
  const listRes = await fetch(`${BASE_URL}/api/leads`, {
    headers: authHeaders
  });

  if (listRes.status !== 200) {
    throw new Error(`Fetch leads failed with status ${listRes.status}`);
  }

  const leads = await listRes.json();
  if (!Array.isArray(leads) || leads.length === 0) {
    throw new Error('Leads list is empty or not an array');
  }

  const matchingLead = leads.find(l => l.id === createdLeadId);
  if (!matchingLead || matchingLead.name !== 'Jane Doe') {
    throw new Error(`Could not find the submitted lead in the list. Matching: ${JSON.stringify(matchingLead)}`);
  }
  console.log(`🎉 Leads verified. Found: "${matchingLead.name}" (${matchingLead.email})`);

  // ----------------------------------------------------
  // TEST 5: Update Lead Status (Protected)
  // ----------------------------------------------------
  console.log('\n--- Running Test 5: Update Lead Status ---');
  const updateRes = await fetch(`${BASE_URL}/api/leads/${createdLeadId}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'Contacted' })
  });

  if (updateRes.status !== 200) {
    throw new Error(`Status update failed with status ${updateRes.status}`);
  }

  const updateData = await updateRes.json();
  if (updateData.status !== 'Contacted') {
    throw new Error(`Lead status not updated properly: ${updateData.status}`);
  }
  console.log('🎉 Status updated successfully to "Contacted".');

  // ----------------------------------------------------
  // TEST 6: Add Follow-up Note (Protected)
  // ----------------------------------------------------
  console.log('\n--- Running Test 6: Add Follow-up Note ---');
  const noteContent = 'Spoke to Jane. Rebranding project is valued at $5k. Sending proposal draft.';
  const noteRes = await fetch(`${BASE_URL}/api/leads/${createdLeadId}/notes`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ content: noteContent })
  });

  if (noteRes.status !== 201) {
    throw new Error(`Adding follow-up note failed with status ${noteRes.status}`);
  }

  const noteData = await noteRes.json();
  if (!noteData.success || noteData.note.content !== noteContent) {
    throw new Error('Note creation did not return proper note content');
  }
  console.log('🎉 Follow-up note added successfully.');

  // ----------------------------------------------------
  // TEST 7: Get Analytics (Protected)
  // ----------------------------------------------------
  console.log('\n--- Running Test 7: Fetch Analytics Dashboard Metrics ---');
  const analyticsRes = await fetch(`${BASE_URL}/api/analytics`, {
    headers: authHeaders
  });

  if (analyticsRes.status !== 200) {
    throw new Error(`Fetch analytics failed with status ${analyticsRes.status}`);
  }

  const analytics = await analyticsRes.json();
  console.log('KPI Summary:', analytics.kpis);
  
  if (analytics.kpis.totalLeads < 1 || analytics.kpis.contactedLeads < 1) {
    throw new Error('Analytics calculations did not count the newly added and updated lead');
  }
  console.log('🎉 Analytics validation successful.');
}

runTests();
