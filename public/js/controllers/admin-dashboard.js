/* ==========================================================================
   CampusCare - Admin Dashboard & Realtime Analytics Controller
   ========================================================================== */

import { requireRole, resolveUrl } from '../utils/guards.js';
import { subscribeToAnalytics } from '../services/analytics.service.js';
import { 
  getAllComplaints, 
  updateComplaintStatus, 
  assignComplaintToFaculty, 
  deleteComplaint,
  exportComplaintsReport,
  getCategories,
  createCategory,
  deleteCategory
} from '../services/complaint.service.js';
import { getAllFaculty, createFaculty } from '../services/user.service.js';
import { renderStatusBadge, renderUrgencyBadge } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';
import { showLoader, hideLoader } from '../utils/loader.js';

let adminUserObj = null;
let currentComplaintsList = [];
let allFacultyList = [];
let activeSelectedComplaintId = null;

// Chart.js Instances
let categoryChartInstance = null;
let departmentChartInstance = null;
let statusChartInstance = null;
let priorityChartInstance = null;
let facultyChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { profile } = await requireRole('admin');
    adminUserObj = profile;
    updateAdminNav(profile);

    // Preload faculty members
    await loadFacultyOptions();

    initRealtimeAnalytics();
    initFilterEvents();
    initModalEvents();
    initExportButton();
    initFacultyManagementModal();
    initCategoriesModal();
  } catch (err) {
    console.error('Admin dashboard controller error:', err);
  }
});

function updateAdminNav(profile) {
  const adminNameEl = document.getElementById('admin-display-name');
  if (adminNameEl) adminNameEl.textContent = profile.fullName || 'Administrator';
}

async function loadFacultyOptions() {
  allFacultyList = await getAllFaculty();
  
  // Populate faculty filter dropdown
  const filterSelect = document.getElementById('faculty-filter');
  if (filterSelect) {
    filterSelect.innerHTML = '<option value="ALL">All Faculty</option>' +
      allFacultyList.map(f => `<option value="${f.uid}">${escapeHtml(f.fullName || f.name)}</option>`).join('');
  }

  // Populate triage modal faculty select
  const modalSelect = document.getElementById('modal-faculty-select');
  if (modalSelect) {
    modalSelect.innerHTML = '<option value="">Unassigned</option>' +
      allFacultyList.map(f => `<option value="${f.uid}">${escapeHtml(f.fullName || f.name)} (${f.facultyId || f.department || 'Faculty'})</option>`).join('');
  }
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
    const pendingFacultyEl = document.getElementById('stat-pending-faculty');
    const inProgressEl = document.getElementById('stat-inprogress');
    const highCriticalEl = document.getElementById('stat-high-critical');
    const resolvedEl = document.getElementById('stat-resolved');
    const reopenedEl = document.getElementById('stat-reopened');
    const rejectedEl = document.getElementById('stat-rejected');

    if (totalEl) totalEl.textContent = metrics.total;
    if (submittedEl) submittedEl.textContent = metrics.submitted;
    if (pendingFacultyEl) pendingFacultyEl.textContent = metrics.pendingFacultyAction;
    if (inProgressEl) inProgressEl.textContent = metrics.inProgress;
    if (highCriticalEl) highCriticalEl.textContent = metrics.highCritical;
    if (resolvedEl) resolvedEl.textContent = metrics.resolved + metrics.closed;
    if (reopenedEl) reopenedEl.textContent = metrics.reopened;
    if (rejectedEl) rejectedEl.textContent = metrics.rejected;

    // 2. Render 5 Realtime Chart.js Visualizations
    renderCategoryDoughnutChart(metrics.categoriesMap);
    renderDepartmentBarChart(metrics.departmentMap);
    renderStatusDistributionChart(metrics.statusMap);
    renderPriorityDistributionChart(metrics.priorityMap);
    renderFacultyWorkloadChart(metrics.facultyWorkloadMap);

    // 3. Render Master Complaints Database Table
    currentComplaintsList = await getAllComplaints();
    applyFiltersAndRenderTable();
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
        backgroundColor: ['#5B5CEB', '#3B82F6', '#16A34A', '#F59E0B', '#DC2626', '#8B5CF6', '#64748B'],
        borderWidth: 2,
        borderColor: 'transparent'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } }
      }
    }
  });
}

/**
 * Chart 2: Department Distribution (Bar Chart)
 */
function renderDepartmentBarChart(departmentMap) {
  const ctx = document.getElementById('department-chart');
  if (!ctx) return;

  const labels = Object.keys(departmentMap);
  const data = Object.values(departmentMap);

  if (labels.length === 0) {
    labels.push('General');
    data.push(0);
  }

  if (departmentChartInstance) departmentChartInstance.destroy();

  departmentChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Complaints',
        data: data,
        backgroundColor: '#3B82F6',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: { ticks: { maxRotation: 25, minRotation: 0 } }
      }
    }
  });
}

/**
 * Chart 3: Status Distribution
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
        backgroundColor: [
          '#6366F1', // Submitted
          '#8B5CF6', // Assigned
          '#10B981', // Accepted
          '#3B82F6', // In Progress
          '#059669', // Resolved
          '#475569', // Closed
          '#EF4444', // Rejected
          '#F97316'  // Reopened
        ],
        borderWidth: 2,
        borderColor: 'transparent'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, padding: 8 } }
      }
    }
  });
}

/**
 * Chart 4: Priority / Urgency Distribution
 */
function renderPriorityDistributionChart(urgencyMap) {
  const ctx = document.getElementById('priority-chart');
  if (!ctx) return;

  const labels = ['Low', 'Medium', 'High', 'Critical'];
  const data = labels.map(l => urgencyMap[l] || 0);

  if (priorityChartInstance) priorityChartInstance.destroy();

  priorityChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Tickets',
        data: data,
        backgroundColor: ['#64748B', '#F59E0B', '#EA580C', '#DC2626'],
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
 * Chart 5: Faculty Workload
 */
function renderFacultyWorkloadChart(workloadMap) {
  const ctx = document.getElementById('faculty-chart');
  if (!ctx) return;

  let labels = Object.keys(workloadMap);
  let data = Object.values(workloadMap);

  if (labels.length === 0) {
    labels = ['Prof. Sarah Jenkins'];
    data = [0];
  }

  if (facultyChartInstance) facultyChartInstance.destroy();

  facultyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Assigned Complaints',
        data: data,
        backgroundColor: '#8B5CF6',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

/**
 * Render Master Complaints Table with filters
 */
function applyFiltersAndRenderTable() {
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('status-filter');
  const categoryFilter = document.getElementById('category-filter');
  const urgencyFilter = document.getElementById('urgency-filter');
  const facultyFilter = document.getElementById('faculty-filter');

  const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const statusVal = statusFilter ? statusFilter.value : 'ALL';
  const categoryVal = categoryFilter ? categoryFilter.value : 'ALL';
  const priorityVal = urgencyFilter ? urgencyFilter.value : 'ALL';
  const facultyVal = facultyFilter ? facultyFilter.value : 'ALL';

  let filtered = [...currentComplaintsList];

  if (statusVal !== 'ALL') {
    filtered = filtered.filter(c => c.status === statusVal);
  }
  if (categoryVal !== 'ALL') {
    filtered = filtered.filter(c => c.category === categoryVal);
  }
  if (priorityVal !== 'ALL') {
    filtered = filtered.filter(c => {
      const p = c.priority || c.urgency || '';
      return p.toLowerCase() === priorityVal.toLowerCase();
    });
  }
  if (facultyVal !== 'ALL') {
    filtered = filtered.filter(c => c.assignedFacultyId === facultyVal);
  }
  if (searchQuery) {
    filtered = filtered.filter(c => 
      (c.ticketId && c.ticketId.toLowerCase().includes(searchQuery)) ||
      (c.title && c.title.toLowerCase().includes(searchQuery)) ||
      (c.studentName && c.studentName.toLowerCase().includes(searchQuery)) ||
      (c.studentId && c.studentId.toLowerCase().includes(searchQuery)) ||
      (c.department && c.department.toLowerCase().includes(searchQuery)) ||
      (c.assignedFacultyName && c.assignedFacultyName.toLowerCase().includes(searchQuery)) ||
      (c.location && c.location.toLowerCase().includes(searchQuery))
    );
  }

  renderComplaintsTable(filtered);
}

function renderComplaintsTable(list) {
  const tbody = document.getElementById('admin-complaints-tbody');
  const countEl = document.getElementById('results-count');

  if (countEl) countEl.textContent = `${list.length} records found`;
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:3rem; color:var(--text-muted);">
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
        <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(c.studentName)}</div>
        <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(c.department || 'Student')}</div>
      </td>
      <td><span class="badge" style="background:var(--border-light); color:var(--text-primary);">${escapeHtml(c.category)}</span></td>
      <td>${renderUrgencyBadge(c.priority || c.urgency)}</td>
      <td>
        <div style="display:flex; align-items:center; gap:0.35rem;">
          <span style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">${escapeHtml(c.assignedFacultyName || 'Unassigned')}</span>
        </div>
      </td>
      <td>${renderStatusBadge(c.status)}</td>
      <td>
        <div style="display:flex; gap:0.35rem;">
          <a href="${resolveUrl('/admin/detail.html?id=' + c.id)}" class="btn btn-outline btn-sm" title="View Details">
            <i class="fa-solid fa-eye"></i> View
          </a>
          <button 
            class="btn btn-primary btn-sm triage-btn" 
            data-id="${c.id}" 
            data-status="${c.status}" 
            data-faculty="${c.assignedFacultyId || ''}"
            data-remarks="${escapeHtml(c.adminRemarks || '')}"
            title="Triage & Assign"
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

  // Triage button handlers
  tbody.querySelectorAll('.triage-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSelectedComplaintId = btn.dataset.id;
      openTriageModal({
        status: btn.dataset.status,
        facultyId: btn.dataset.faculty,
        remarks: btn.dataset.remarks
      });
    });
  });

  // Delete button handlers
  tbody.querySelectorAll('.delete-btn').forEach(btn => {
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

function initFilterEvents() {
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('status-filter');
  const categoryFilter = document.getElementById('category-filter');
  const urgencyFilter = document.getElementById('urgency-filter');
  const facultyFilter = document.getElementById('faculty-filter');

  if (searchInput) searchInput.addEventListener('input', applyFiltersAndRenderTable);
  if (statusFilter) statusFilter.addEventListener('change', applyFiltersAndRenderTable);
  if (categoryFilter) categoryFilter.addEventListener('change', applyFiltersAndRenderTable);
  if (urgencyFilter) urgencyFilter.addEventListener('change', applyFiltersAndRenderTable);
  if (facultyFilter) facultyFilter.addEventListener('change', applyFiltersAndRenderTable);
}

function openTriageModal(data) {
  const modal = document.getElementById('triage-modal-overlay');
  const statusSelect = document.getElementById('modal-status-select');
  const facultySelect = document.getElementById('modal-faculty-select');
  const remarksInput = document.getElementById('modal-remarks-input');

  if (statusSelect) statusSelect.value = data.status || 'Submitted';
  if (facultySelect) facultySelect.value = data.facultyId || '';
  if (remarksInput) remarksInput.value = data.remarks || '';

  if (modal) modal.style.display = 'flex';
}

function initModalEvents() {
  const modal = document.getElementById('triage-modal-overlay');
  const form = document.getElementById('triage-form');

  document.querySelectorAll('.close-modal-trigger').forEach(el => {
    el.addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
      activeSelectedComplaintId = null;
    });
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeSelectedComplaintId) return;

      const status = form.status.value;
      const facultyId = form.facultyId.value;
      const remarks = form.remarks.value.trim();

      let facultyName = 'Unassigned';
      if (facultyId) {
        const found = allFacultyList.find(f => f.uid === facultyId);
        facultyName = found ? (found.fullName || found.name) : 'Faculty';
      }

      try {
        showLoader('Updating complaint status and assignment...');
        
        if (facultyId && status === 'Assigned') {
          await assignComplaintToFaculty(activeSelectedComplaintId, adminUserObj, facultyId, facultyName, remarks);
        } else {
          await updateComplaintStatus(activeSelectedComplaintId, adminUserObj, status, remarks, facultyName);
        }

        hideLoader();
        if (modal) modal.style.display = 'none';
        showToast('Complaint status updated successfully!', 'success');
      } catch (err) {
        hideLoader();
        console.error('Triage update error:', err);
        showToast('Failed to update complaint.', 'error');
      }
    });
  }
}

function initExportButton() {
  const exportBtn = document.getElementById('export-csv-btn');
  if (!exportBtn) return;

  exportBtn.addEventListener('click', async () => {
    try {
      showLoader('Generating CSV export report...');
      await exportComplaintsReport(currentComplaintsList);
      hideLoader();
      showToast('Complaints report exported successfully!', 'success');
    } catch (err) {
      hideLoader();
      showToast(err.message || 'Export failed.', 'error');
    }
  });
}

function initFacultyManagementModal() {
  const modal = document.getElementById('faculty-management-modal');
  const openBtn = document.getElementById('manage-faculty-btn');
  const closeBtn = document.getElementById('close-faculty-modal-btn');
  const toggleAddBtn = document.getElementById('toggle-add-faculty-btn');
  const addFormContainer = document.getElementById('add-faculty-form-container');
  const cancelAddBtn = document.getElementById('cancel-add-faculty-btn');
  const addForm = document.getElementById('add-faculty-form');

  if (openBtn) {
    openBtn.addEventListener('click', async () => {
      await renderFacultyRoster();
      if (modal) modal.style.display = 'flex';
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
  if (cancelAddBtn) cancelAddBtn.addEventListener('click', () => { if (addFormContainer) addFormContainer.style.display = 'none'; });

  if (toggleAddBtn) {
    toggleAddBtn.addEventListener('click', () => {
      if (addFormContainer) {
        addFormContainer.style.display = addFormContainer.style.display === 'none' ? 'block' : 'none';
      }
    });
  }

  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = document.getElementById('new-faculty-name').value.trim();
      const email = document.getElementById('new-faculty-email').value.trim();
      const department = document.getElementById('new-faculty-dept').value.trim();
      const facultyId = document.getElementById('new-faculty-id').value.trim();

      try {
        showLoader('Registering new faculty member...');
        await createFaculty({ fullName, email, department, facultyId });
        hideLoader();
        showToast(`Faculty ${fullName} registered successfully!`, 'success');
        addForm.reset();
        if (addFormContainer) addFormContainer.style.display = 'none';
        await loadFacultyOptions();
        await renderFacultyRoster();
      } catch (err) {
        hideLoader();
        showToast(err.message || 'Failed to add faculty.', 'error');
      }
    });
  }
}

async function renderFacultyRoster() {
  const tbody = document.getElementById('admin-faculty-list-tbody');
  if (!tbody) return;

  const list = await getAllFaculty();
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No faculty registered yet.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(f => `
    <tr>
      <td><strong>${escapeHtml(f.fullName || f.name)}</strong></td>
      <td><span class="badge" style="background:var(--border-light); color:var(--text-primary);">${escapeHtml(f.facultyId || 'FAC-100')}</span></td>
      <td>${escapeHtml(f.department || 'General')}</td>
      <td>${escapeHtml(f.email)}</td>
      <td><span class="badge badge-resolved">Active</span></td>
    </tr>
  `).join('');
}

function initCategoriesModal() {
  const modal = document.getElementById('categories-modal');
  const openBtn = document.getElementById('manage-categories-btn');
  const closeBtn = document.getElementById('close-categories-modal-btn');
  const addForm = document.getElementById('add-category-form');

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      renderCategoriesList();
      if (modal) modal.style.display = 'flex';
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });

  if (addForm) {
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('new-category-input');
      const val = input.value.trim();
      if (val) {
        createCategory(val);
        input.value = '';
        renderCategoriesList();
        showToast(`Category "${val}" added.`, 'success');
      }
    });
  }
}

function renderCategoriesList() {
  const container = document.getElementById('categories-list-container');
  if (!container) return;

  const cats = getCategories();
  container.innerHTML = cats.map(c => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; background:var(--bg-surface-raised); border-radius:var(--radius-sm); border:1px solid var(--border-color);">
      <span style="font-weight:600; color:var(--text-primary); font-size:0.88rem;"><i class="fa-solid fa-tag" style="color:var(--color-brand); margin-right:0.4rem;"></i> ${escapeHtml(c)}</span>
      <button type="button" class="btn btn-outline btn-sm delete-cat-btn" data-cat="${escapeHtml(c)}" style="padding:0.2rem 0.5rem; font-size:0.75rem; color:var(--color-danger); border-color:var(--border-color);" title="Delete category">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `).join('');

  container.querySelectorAll('.delete-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      if (confirm(`Delete category "${cat}"?`)) {
        deleteCategory(cat);
        renderCategoriesList();
        showToast(`Category "${cat}" removed.`, 'info');
      }
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
