document.addEventListener('DOMContentLoaded', () => {
  // Check authorization
  const token = localStorage.getItem('crm_token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // DOM Elements
  const logoutBtn = document.getElementById('logoutBtn');
  const todayDate = document.getElementById('todayDate');
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const sourceFilter = document.getElementById('sourceFilter');
  const leadsTableBody = document.getElementById('leadsTableBody');

  // KPI Elements
  const kpiTotal = document.getElementById('kpiTotal');
  const kpiContacted = document.getElementById('kpiContacted');
  const kpiConverted = document.getElementById('kpiConverted');
  const kpiConversionRate = document.getElementById('kpiConversionRate');

  // Modal Elements
  const leadModal = document.getElementById('leadModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalLeadName = document.getElementById('modalLeadName');
  const modalCompanyText = document.getElementById('modalCompanyText');
  const modalEmail = document.getElementById('modalEmail');
  const modalPhone = document.getElementById('modalPhone');
  const modalSource = document.getElementById('modalSource');
  const modalDate = document.getElementById('modalDate');
  const modalMessage = document.getElementById('modalMessage');
  const addNoteForm = document.getElementById('addNoteForm');
  const noteInput = document.getElementById('noteInput');
  const notesTimeline = document.getElementById('notesTimeline');
  const statusToggles = document.querySelectorAll('.btn-status-toggle');

  // Global State
  let currentLeadId = null;
  let chartInstances = {};

  // Formatted Date Header
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  todayDate.textContent = new Date().toLocaleDateString('en-US', dateOptions);

  // Logout Handler
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('crm_token');
    window.location.href = '/login.html';
  });

  // Helper: Get Auth Headers
  function getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  // ----------------------------------------------------
  // INITIALIZE APP
  // ----------------------------------------------------
  init();

  function init() {
    fetchAnalytics();
    fetchLeads();
    setupEventListeners();
  }

  function setupEventListeners() {
    // Search with debounce
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchLeads();
      }, 300);
    });

    // Filters
    statusFilter.addEventListener('change', fetchLeads);
    sourceFilter.addEventListener('change', fetchLeads);

    // Modal Close
    closeModalBtn.addEventListener('click', closeLeadModal);
    leadModal.addEventListener('click', (e) => {
      if (e.target === leadModal) {
        closeLeadModal();
      }
    });

    // Modal Status update
    statusToggles.forEach(btn => {
      btn.addEventListener('click', async () => {
        const newStatus = btn.getAttribute('data-status');
        if (currentLeadId && newStatus) {
          await updateLeadStatus(currentLeadId, newStatus);
        }
      });
    });

    // Add Note Submit
    addNoteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = noteInput.value.trim();
      if (content && currentLeadId) {
        await addFollowUpNote(currentLeadId, content);
      }
    });
  }

  // ----------------------------------------------------
  // FETCH ANALYTICS & RENDER CHARTS
  // ----------------------------------------------------
  async function fetchAnalytics() {
    try {
      const response = await fetch('/api/analytics', {
        headers: getHeaders()
      });

      if (response.status === 401 || response.status === 403) {
        handleAuthError();
        return;
      }

      const data = await response.json();
      renderKPIs(data.kpis);
      renderCharts(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  }

  function renderKPIs(kpis) {
    kpiTotal.textContent = kpis.totalLeads;
    kpiContacted.textContent = kpis.contactedLeads;
    kpiConverted.textContent = kpis.convertedLeads;
    kpiConversionRate.textContent = `${kpis.conversionRate}%`;
  }

  function renderCharts(data) {
    const statusData = data.statusBreakdown;
    const sourceData = data.sourceBreakdown;
    const trendData = data.trendData;

    // Colors mapping
    const colors = {
      New: '#3b82f6',
      Contacted: '#a855f7',
      Converted: '#10b981',
      Lost: '#f43f5e'
    };

    // 1. STATUS CHART (Doughnut)
    if (chartInstances.status) chartInstances.status.destroy();
    const statusCtx = document.getElementById('statusChart').getContext('2d');
    chartInstances.status = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: statusData.map(d => d.status),
        datasets: [{
          data: statusData.map(d => d.count),
          backgroundColor: statusData.map(d => colors[d.status] || '#6b7280'),
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.08)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#9ca3af', font: { family: 'Outfit', size: 11 } }
          }
        }
      }
    });

    // 2. SOURCE CHART (Horizontal Bar)
    if (chartInstances.source) chartInstances.source.destroy();
    const sourceCtx = document.getElementById('sourceChart').getContext('2d');
    chartInstances.source = new Chart(sourceCtx, {
      type: 'bar',
      data: {
        labels: sourceData.map(d => d.source),
        datasets: [{
          label: 'Leads',
          data: sourceData.map(d => d.count),
          backgroundColor: '#6366f1',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: '#9ca3af', stepSize: 1, font: { family: 'Outfit' } },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          y: {
            ticks: { color: '#9ca3af', font: { family: 'Outfit' } },
            grid: { display: false }
          }
        }
      }
    });

    // 3. TREND CHART (Line)
    if (chartInstances.trend) chartInstances.trend.destroy();
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    
    // Fill in dates for last 7 days if empty
    const labels = [];
    const counts = [];
    
    // Generate simple array for last 7 dates
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      
      const found = trendData.find(item => item.date === dateStr);
      counts.push(found ? found.count : 0);
    }

    chartInstances.trend = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'New Leads',
          data: counts,
          borderColor: '#d946ef',
          backgroundColor: 'rgba(217, 70, 239, 0.05)',
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointBackgroundColor: '#d946ef'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: '#9ca3af', font: { family: 'Outfit' } },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          y: {
            ticks: { color: '#9ca3af', stepSize: 1, font: { family: 'Outfit' } },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });
  }

  // ----------------------------------------------------
  // FETCH LEADS LIST
  // ----------------------------------------------------
  async function fetchLeads() {
    try {
      const search = searchInput.value.trim();
      const status = statusFilter.value;
      const source = sourceFilter.value;

      let url = '/api/leads?';
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (status) url += `status=${encodeURIComponent(status)}&`;
      if (source) url += `source=${encodeURIComponent(source)}&`;

      const response = await fetch(url, {
        headers: getHeaders()
      });

      if (response.status === 401 || response.status === 403) {
        handleAuthError();
        return;
      }

      const leads = await response.json();
      renderLeadsTable(leads);
    } catch (error) {
      console.error('Error fetching leads:', error);
      leadsTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="error-cell">
            <i class="fas fa-exclamation-triangle"></i> Failed to retrieve leads data.
          </td>
        </tr>
      `;
    }
  }

  function renderLeadsTable(leads) {
    if (leads.length === 0) {
      leadsTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="no-leads-cell">
            <i class="fas fa-inbox"></i> No leads found matching the filters.
          </td>
        </tr>
      `;
      return;
    }

    leadsTableBody.innerHTML = '';
    leads.forEach(lead => {
      const tr = document.createElement('tr');
      
      const formattedDate = new Date(lead.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      tr.innerHTML = `
        <td>
          <div class="lead-info">
            <span class="lead-name">${escapeHTML(lead.name)}</span>
            <span class="lead-email">${escapeHTML(lead.email)}</span>
          </div>
        </td>
        <td class="table-company">${escapeHTML(lead.company || '—')}</td>
        <td class="table-source">${escapeHTML(lead.source)}</td>
        <td>
          <span class="badge-status ${lead.status.toLowerCase()}">${lead.status}</span>
        </td>
        <td class="table-date">${formattedDate}</td>
        <td>
          <button class="btn-view-lead" data-id="${lead.id}">
            <i class="fas fa-eye"></i> View details
          </button>
        </td>
      `;

      // Event listener for view detail button
      tr.querySelector('.btn-view-lead').addEventListener('click', () => {
        openLeadModal(lead.id);
      });

      leadsTableBody.appendChild(tr);
    });
  }

  // ----------------------------------------------------
  // LEAD DETAILS MODAL LOGIC
  // ----------------------------------------------------
  async function openLeadModal(leadId) {
    currentLeadId = leadId;
    leadModal.classList.remove('hidden');
    // Freeze body scrolling
    document.body.style.overflow = 'hidden';

    // Show loading timeline state
    notesTimeline.innerHTML = '<div class="loading-cell"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    // Trigger transitions
    setTimeout(() => {
      leadModal.classList.add('show');
    }, 10);

    await fetchLeadDetails(leadId);
  }

  function closeLeadModal() {
    leadModal.classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(() => {
      leadModal.classList.add('hidden');
      currentLeadId = null;
      noteInput.value = '';
    }, 300);
  }

  async function fetchLeadDetails(leadId) {
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        headers: getHeaders()
      });

      if (response.status === 401 || response.status === 403) {
        handleAuthError();
        return;
      }

      const data = await response.json();
      populateModal(data.lead, data.notes);
    } catch (error) {
      console.error('Error fetching lead details:', error);
    }
  }

  function populateModal(lead, notes) {
    modalLeadName.textContent = lead.name;
    modalCompanyText.textContent = lead.company || 'Individual Lead';
    modalEmail.textContent = lead.email;
    modalPhone.textContent = lead.phone || 'Not provided';
    modalSource.textContent = lead.source;
    
    const formattedDate = new Date(lead.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    modalDate.textContent = formattedDate;
    modalMessage.textContent = lead.message || 'No initial project details provided.';

    // Set active status toggle button
    statusToggles.forEach(btn => {
      if (btn.getAttribute('data-status') === lead.status) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Populate notes timeline
    renderTimeline(notes);
  }

  function renderTimeline(notes) {
    if (notes.length === 0) {
      notesTimeline.innerHTML = '<p class="text-muted" style="font-size: 14px;">No timeline notes available.</p>';
      return;
    }

    notesTimeline.innerHTML = '';
    notes.forEach(note => {
      const div = document.createElement('div');
      
      const isSystem = note.content.startsWith('System:');
      const author = isSystem ? 'System Automatic' : 'Admin Staff';
      const noteClass = isSystem ? 'system-note' : 'user-note';
      
      const displayContent = isSystem ? note.content.replace('System:', '').trim() : note.content;

      const formattedTime = new Date(note.created_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      div.className = `timeline-item ${noteClass}`;
      div.innerHTML = `
        <div class="timeline-marker"></div>
        <div class="timeline-card">
          <div class="timeline-meta">
            <span class="author">${author}</span>
            <span class="time">${formattedTime}</span>
          </div>
          <div class="timeline-content">${escapeHTML(displayContent)}</div>
        </div>
      `;
      notesTimeline.appendChild(div);
    });
  }

  // Update Status API
  async function updateLeadStatus(leadId, status) {
    try {
      const response = await fetch(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        // Refresh details modal
        await fetchLeadDetails(leadId);
        // Refresh underlying dashboard list & analytics
        fetchLeads();
        fetchAnalytics();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

  // Add Follow-up Note API
  async function addFollowUpNote(leadId, content) {
    try {
      const response = await fetch(`/api/leads/${leadId}/notes`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ content })
      });

      if (response.ok) {
        noteInput.value = '';
        // Refresh details modal
        await fetchLeadDetails(leadId);
      }
    } catch (error) {
      console.error('Error adding note:', error);
    }
  }

  // ----------------------------------------------------
  // UTILITIES
  // ----------------------------------------------------
  function handleAuthError() {
    localStorage.removeItem('crm_token');
    window.location.href = '/login.html';
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
