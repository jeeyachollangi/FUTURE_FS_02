require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { initDb, dbRun, dbGet, dbAll } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'crm-super-secret-key-apex-digital-2026';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
};

// ----------------------------------------------------
// PUBLIC ROUTES
// ----------------------------------------------------

// Submit lead from public website form
app.post('/api/leads', async (req, res) => {
  try {
    const { name, email, phone, company, source, message } = req.body;

    if (!name || !email || !source) {
      return res.status(400).json({ error: 'Name, email, and lead source are required.' });
    }

    const query = `
      INSERT INTO leads (name, email, phone, company, source, status, message)
      VALUES (?, ?, ?, ?, ?, 'New', ?)
    `;
    const result = await dbRun(query, [
      name,
      email,
      phone || null,
      company || null,
      source,
      message || null
    ]);

    // Insert an initial system note
    await dbRun(
      'INSERT INTO notes (lead_id, content) VALUES (?, ?)',
      [result.id, 'Lead created automatically via website form submission.']
    );

    res.status(201).json({
      success: true,
      message: 'Lead submitted successfully!',
      leadId: result.id
    });
  } catch (error) {
    console.error('Error submitting lead:', error);
    res.status(500).json({ error: 'Server error while submitting lead.' });
  }
});

// Admin Login Route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// ----------------------------------------------------
// PROTECTED API ROUTES (ADMIN ONLY)
// ----------------------------------------------------

// Get all leads with sorting, search, and status/source filters
app.get('/api/leads', authenticateToken, async (req, res) => {
  try {
    const { search, status, source } = req.query;
    let query = 'SELECT * FROM leads WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR email LIKE ? OR company LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }

    query += ' ORDER BY created_at DESC';

    const leads = await dbAll(query, params);
    res.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Server error fetching leads.' });
  }
});

// Get a single lead details including follow-up notes
app.get('/api/leads/:id', authenticateToken, async (req, res) => {
  try {
    const leadId = req.params.id;

    const lead = await dbGet('SELECT * FROM leads WHERE id = ?', [leadId]);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const notes = await dbAll('SELECT * FROM notes WHERE lead_id = ? ORDER BY created_at DESC', [leadId]);

    res.json({
      lead,
      notes
    });
  } catch (error) {
    console.error('Error fetching lead details:', error);
    res.status(500).json({ error: 'Server error fetching lead details.' });
  }
});

// Update lead status
app.patch('/api/leads/:id/status', authenticateToken, async (req, res) => {
  try {
    const leadId = req.params.id;
    const { status } = req.body;

    const validStatuses = ['New', 'Contacted', 'Converted', 'Lost'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid lead status.' });
    }

    const lead = await dbGet('SELECT status FROM leads WHERE id = ?', [leadId]);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const oldStatus = lead.status;
    await dbRun('UPDATE leads SET status = ? WHERE id = ?', [status, leadId]);

    // Log the status update as a system note
    await dbRun(
      'INSERT INTO notes (lead_id, content) VALUES (?, ?)',
      [leadId, `System: Lead status updated from "${oldStatus}" to "${status}".`]
    );

    res.json({
      success: true,
      message: 'Lead status updated successfully',
      status
    });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Server error updating status.' });
  }
});

// Add follow-up note to lead
app.post('/api/leads/:id/notes', authenticateToken, async (req, res) => {
  try {
    const leadId = req.params.id;
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Note content cannot be empty.' });
    }

    const lead = await dbGet('SELECT id FROM leads WHERE id = ?', [leadId]);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const result = await dbRun(
      'INSERT INTO notes (lead_id, content) VALUES (?, ?)',
      [leadId, content.trim()]
    );

    const newNote = await dbGet('SELECT * FROM notes WHERE id = ?', [result.id]);

    res.status(201).json({
      success: true,
      message: 'Note added successfully',
      note: newNote
    });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Server error adding note.' });
  }
});

// Get analytics data for admin dashboard
app.get('/api/analytics', authenticateToken, async (req, res) => {
  try {
    // 1. Core KPIs
    const totalLeads = await dbGet('SELECT COUNT(*) as count FROM leads');
    const newLeads = await dbGet('SELECT COUNT(*) as count FROM leads WHERE status = "New"');
    const contactedLeads = await dbGet('SELECT COUNT(*) as count FROM leads WHERE status = "Contacted"');
    const convertedLeads = await dbGet('SELECT COUNT(*) as count FROM leads WHERE status = "Converted"');
    const lostLeads = await dbGet('SELECT COUNT(*) as count FROM leads WHERE status = "Lost"');

    const totalCount = totalLeads.count;
    const conversionRate = totalCount > 0 
      ? parseFloat(((convertedLeads.count / totalCount) * 100).toFixed(1)) 
      : 0;

    // 2. Status Breakdown
    const statusBreakdown = await dbAll(`
      SELECT status, COUNT(*) as count 
      FROM leads 
      GROUP BY status
    `);

    // 3. Source Breakdown
    const sourceBreakdown = await dbAll(`
      SELECT source, COUNT(*) as count 
      FROM leads 
      GROUP BY source
    `);

    // 4. Monthly Trend (leads created in last 7 days)
    // Using date function in SQLite
    const trendData = await dbAll(`
      SELECT date(created_at) as date, COUNT(*) as count
      FROM leads
      WHERE created_at >= date('now', '-7 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `);

    res.json({
      kpis: {
        totalLeads: totalCount,
        newLeads: newLeads.count,
        contactedLeads: contactedLeads.count,
        convertedLeads: convertedLeads.count,
        lostLeads: lostLeads.count,
        conversionRate
      },
      statusBreakdown,
      sourceBreakdown,
      trendData
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Server error fetching analytics.' });
  }
});

// Serve frontend routing fallback (if admin refreshes page, redirect to index)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 Mini CRM Server is running on port ${PORT}`);
    console.log(`🔗 Admin Login URL: http://localhost:${PORT}/login.html`);
    console.log(`🔗 Admin Dashboard: http://localhost:${PORT}/dashboard.html`);
    console.log(`🔗 Public Lead Form: http://localhost:${PORT}/`);
    console.log(`==================================================`);
  });
}

start();
