/* ==========================================================================
   CampusCare - Admin Dashboard & Realtime Analytics Controller
   ========================================================================== */

import { requireAuth, resolveUrl } from '../utils/guards.js';
import { subscribeToAnalytics } from '../services/analytics.service.js';
import { getAllComplaints, updateComplaintStatus, deleteComplaint } from '../services/complaint.service.js';
import { renderStatusBadge, renderUrgencyBadge } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';
import { showLoader, hideLoader } from '../utils/loader.js';

let adminUserObj = null;
let currentComplaintsList = [];
let activeSelectedComplaintId = null;

// Chart.js Instances
let categoryChartInstance = null;
let monthlyChartInstance = null;
let statusChartInstance = null;
let priorityChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { profile } = await requireAuth('admin');
    adminUserObj = profile;
    updateAdminNav(profile);
    initRealtimeAnalytics();
    initFilterEvents();
    initModalEvents();
  } catch (err) {
    console.error('Admin dashboard controller error:', err);
  }
});

function updateAdminNav(profile) {
  const adminNameEl = document.getElementById('admin-display-name');
  if (adminNameEl) adminNameEl.textContent = profile.fullName || 'Administrator';
}

/**
 * Initialize Realtime Firestore Listener for Analytics & Table Data
 */
function initRealtimeAnalytics() {
  showLoader('Connecting to Firestore realtime stream...');
  
  subscribeToAnalytics(async (metrics) => {
    hideLoader();

    // 1. Metric Stat Cards
    const totalEl = document.getElementById('stat-total');
    const submittedEl = document.getElementById('stat-submitted');
    const inProgressEl = document.getElementById('stat-inprogress');
    const resolvedEl = document.getElementById('stat-resolved');

    if (totalEl) totalEl.textContent = metrics.total;
    if (submittedEl) submittedEl.textContent = metrics.submitted;
    if (inProgressEl) inProgressEl.textContent = metrics.inProgress;
    if (resolvedEl) resolvedEl.textContent = metrics.resolved;

    // 2. Render 4 Realtime Chart.js Visualizations
    renderCategoryDoughnutChart(metrics.categoriesMap);
    renderMonthlyTrendChart(metrics.monthlyMap);
    renderStatusDistributionChart(metrics.statusMap);
    renderPriorityDistributionChart(metrics.urgencyMap);

    // 3. Render Master Complaints Database Table
    currentComplaintsList = await getAllComplaints();
    renderComplaintsTable(currentComplaintsList);
  });
}

/**
 * Chart 1: Complaints by Category (Doughnut Chart)
 */
function renderCategoryDoughnutChart(categoriesMap) {
  const ctx = document.getElementById('category-chart');
  if (!ctx) return;

  const labels = Object.keys(categoriesMap);
  const data = Object.values(categoriesMap);

  if (labels.length === 0) {
    labels.push('General');
    data.push(1);
  }

  if (categoryChartInstance) categoryChartInstance.destroy();

  categoryChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'],
        borderWidth: 2,
        borderColor: 'transparent'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12 }, padding: 12 } }
      },
      cutout: '65%'
    }
  });
}

/**
 * Chart 2: Monthly Complaints (Line / Area Trend Chart)
 */
function renderMonthlyTrendChart(monthlyMap) {
  const ctx = document.getElementById('monthly-chart');
  if (!ctx) return;

  const labels = Object.keys(monthlyMap);
  const data = Object.values(monthlyMap);

  if (monthlyChartInstance) monthlyChartInstance.destroy();

  monthlyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Monthly Complaints',
        data: data,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#2563eb',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

/**
 * Chart 3: Status Distribution (Doughnut Chart)
 */
function renderStatusDistributionChart(statusMap) {
  const ctx = document.getElementById('status-chart');
  if (!ctx) return;

  const labels = Object.keys(statusMap);
  const data = Object.values(statusMap);

  if (statusChartInstance) statusChartInstance.destroy();

  statusChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: ['#f59e0b', '#b45309', '#4338ca', '#2563eb', '#10b981', '#64748b', '#ef4444'],
        borderWidth: 2,
        borderColor: 'transparent'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11 }, padding: 10 } }
      },
      cutout: '65%'
    }
  });
}

/**
 * Chart 4: Priority / Urgency Distribution (Bar Chart)
 */
function renderPriorityDistributionChart(urgencyMap) {
  const ctx = document.getElementById('priority-chart');
  if (!ctx) return;

  const labels = Object.keys(urgencyMap);
  const data = Object.values(urgencyMap);

  if (priorityChartInstance) priorityChartInstance.destroy();

  priorityChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Tickets',
        data: data,
        backgroundColor: ['#94a3b8', '#f59e0b', '#ea580c', '#dc2626'],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

/**
 * Render Master Complaints Database Table
 */
function renderComplaintsTable(list) {
  const tbody = document.getElementById('admin-complaints-tbody');
  const countEl = document.getElementById('results-count');

  if (countEl) countEl.textContent = `${list.length} records found`;
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:3rem; color:var(--text-muted);">
          No complaints found matching current search and filter criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr>
      <td><span class="ticket-id">${c.ticketId}</span></td>
      <td>
        <div style="font-weight:700; color:var(--text-primary);">${escapeHtml(c.title)}</div>
        <div style="font-size:0.78rem; color:var(--text-muted);"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(c.location || 'N/A')}</div>
      </td>
      <td>
        <div>${escapeHtml(c.studentName)}</div>
        <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(c.department || 'Student')}</div>
      </td>
      <td><span class="badge" style="background:var(--border-light); color:var(--text-primary);">${escapeHtml(c.category)}</span></td>
      <td>${renderUrgencyBadge(c.urgency)}</td>
      <td>${renderStatusBadge(c.status)}</td>
      <td>
        <div style="display:flex; gap:0.35rem;">
          <a href="${resolveUrl('/admin/detail.html?id=' + c.id)}" data-id="${c.id}" class="btn btn-outline btn-sm view-detail-link" title="View Details">
            <i class="fa-solid fa-eye"></i> View
          </a>
          <button 
            class="btn btn-primary btn-sm triage-btn" 
            data-id="${c.id}" 
            data-status="${c.status}" 
            data-assigned="${escapeHtml(c.assignedTo || '')}" 
            data-remarks="${escapeHtml(c.adminRemarks || '')}"
            title="Change Status & Assign Department"
          >
            <i class="fa-solid fa-list-check"></i> Triage
          </button>
          <button 
            class="btn btn-danger btn-sm delete-btn" 
            data-id="${c.id}" 
            data-ticket="${c.ticketId}"
            title="Delete Record"
          >
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.view-detail-link').forEach(link => {
    link.addEventListener('click', () => {
      if (link.dataset.id) {
        sessionStorage.setItem('cc_active_complaint_id', link.dataset.id);
      }
    });
  });

  // Triage buttons
  document.querySelectorAll('.triage-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSelectedComplaintId = btn.dataset.id;
      openTriageModal({
        status: btn.dataset.status,
        assignedTo: btn.dataset.assigned,
        remarks: btn.dataset.remarks
      });
    });
  });

  // Delete buttons
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const ticket = btn.dataset.ticket;
      if (confirm(`Are you sure you want to delete complaint ${ticket}?`)) {
        try {
          showLoader('Deleting record...');
          await deleteComplaint(id);
          hideLoader();
          showToast(`Complaint ${ticket} deleted.`, 'success');
        } catch (err) {
          hideLoader();
          console.error('Delete error:', err);
          showToast('Failed to delete complaint.', 'error');
        }
      }
    });
  });
}

/**
 * Filter & Search Listeners
 */
function initFilterEvents() {
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('status-filter');
  const categoryFilter = document.getElementById('category-filter');
  const urgencyFilter = document.getElementById('urgency-filter');

  const handleFilterChange = () => {
    const filters = {
      searchQuery: searchInput ? searchInput.value : '',
      status: statusFilter ? statusFilter.value : 'ALL',
      category: categoryFilter ? categoryFilter.value : 'ALL',
      urgency: urgencyFilter ? urgencyFilter.value : 'ALL'
    };

    let filtered = [...currentComplaintsList];

    if (filters.status !== 'ALL') {
      filtered = filtered.filter(c => c.status === filters.status);
    }
    if (filters.category !== 'ALL') {
      filtered = filtered.filter(c => c.category === filters.category);
    }
    if (filters.urgency !== 'ALL') {
      filtered = filtered.filter(c => c.urgency === filters.urgency);
    }
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(c => 
        (c.ticketId && c.ticketId.toLowerCase().includes(q)) ||
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.studentName && c.studentName.toLowerCase().includes(q)) ||
        (c.department && c.department.toLowerCase().includes(q))
      );
    }

    renderComplaintsTable(filtered);
  };

  if (searchInput) searchInput.addEventListener('input', handleFilterChange);
  if (statusFilter) statusFilter.addEventListener('change', handleFilterChange);
  if (categoryFilter) categoryFilter.addEventListener('change', handleFilterChange);
  if (urgencyFilter) urgencyFilter.addEventListener('change', handleFilterChange);
}

/**
 * Modal Handlers
 */
function openTriageModal(data) {
  const modalOverlay = document.getElementById('triage-modal-overlay');
  const statusSelect = document.getElementById('modal-status-select');
  const assignedInput = document.getElementById('modal-assigned-input');
  const remarksInput = document.getElementById('modal-remarks-input');

  if (statusSelect) statusSelect.value = data.status || 'In Progress';
  if (assignedInput) assignedInput.value = data.assignedTo || '';
  if (remarksInput) remarksInput.value = data.remarks || '';

  if (modalOverlay) modalOverlay.classList.add('active');
}

function closeTriageModal() {
  const modalOverlay = document.getElementById('triage-modal-overlay');
  if (modalOverlay) modalOverlay.classList.remove('active');
}

function initModalEvents() {
  const closeBtns = document.querySelectorAll('.close-modal-trigger');
  closeBtns.forEach(b => b.addEventListener('click', closeTriageModal));

  const triageForm = document.getElementById('triage-form');
  if (triageForm) {
    triageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeSelectedComplaintId) return;

      const status = triageForm.status.value;
      const assignedTo = triageForm.assignedTo.value.trim();
      const remarks = triageForm.remarks.value.trim();

      try {
        showLoader('Updating status and logging timeline event...');
        await updateComplaintStatus(activeSelectedComplaintId, adminUserObj, status, remarks, assignedTo);
        hideLoader();
        showToast('Complaint triage updated successfully!', 'success');
        closeTriageModal();
      } catch (err) {
        hideLoader();
        console.error('Triage update error:', err);
        showToast('Failed to update triage status.', 'error');
      }
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}
