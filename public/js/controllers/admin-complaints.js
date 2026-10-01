/* ==========================================================================
   CampusCare - Admin Complaints Master Table & Status Triage Controller
   ========================================================================== */

import { requireRole, resolveUrl } from '../utils/guards.js';
import { 
  getAllComplaints, 
  updateComplaintStatus, 
  assignComplaintToFaculty,
  listenToAllComplaints,
  exportComplaintsReport
} from '../services/complaint.service.js';
import { getAllFaculty } from '../services/user.service.js';
import { formatDate, renderStatusBadge, renderUrgencyBadge } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';
import { showLoader, hideLoader } from '../utils/loader.js';

let adminUserObj = null;
let currentComplaintsList = [];
let allFacultyList = [];
let activeSelectedComplaintId = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { profile } = await requireRole('admin');
    adminUserObj = profile;
    
    await loadFacultyOptions();

    // Subscribe to Firestore Real-Time Stream
    listenToAllComplaints((updatedList) => {
      currentComplaintsList = updatedList;
      applyFiltersAndRender();
    });

    initFilterEvents();
    initModalEvents();
    initExportBtn();
  } catch (err) {
    console.error('Admin complaints list init error:', err);
  }
});

async function loadFacultyOptions() {
  allFacultyList = await getAllFaculty();

  const filterSelect = document.getElementById('faculty-filter');
  if (filterSelect) {
    filterSelect.innerHTML = '<option value="ALL">All Faculty</option>' +
      allFacultyList.map(f => `<option value="${f.uid}">${escapeHtml(f.fullName || f.name)}</option>`).join('');
  }

  const modalSelect = document.getElementById('modal-faculty-select');
  if (modalSelect) {
    modalSelect.innerHTML = '<option value="">Unassigned</option>' +
      allFacultyList.map(f => `<option value="${f.uid}">${escapeHtml(f.fullName || f.name)} (${f.facultyId || f.department || 'Faculty'})</option>`).join('');
  }
}

function applyFiltersAndRender() {
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('status-filter');
  const categoryFilter = document.getElementById('category-filter');
  const urgencyFilter = document.getElementById('urgency-filter');
  const facultyFilter = document.getElementById('faculty-filter');

  const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const statusVal = statusFilter ? statusFilter.value : 'ALL';
  const categoryVal = categoryFilter ? categoryFilter.value : 'ALL';
  const urgencyVal = urgencyFilter ? urgencyFilter.value : 'ALL';
  const facultyVal = facultyFilter ? facultyFilter.value : 'ALL';

  let filtered = [...currentComplaintsList];

  if (statusVal !== 'ALL') {
    filtered = filtered.filter(c => c.status === statusVal);
  }
  if (categoryVal !== 'ALL') {
    filtered = filtered.filter(c => c.category === categoryVal);
  }
  if (urgencyVal !== 'ALL') {
    filtered = filtered.filter(c => {
      const p = c.priority || c.urgency || '';
      return p.toLowerCase() === urgencyVal.toLowerCase();
    });
  }
  if (facultyVal !== 'ALL') {
    filtered = filtered.filter(c => c.assignedFacultyId === facultyVal);
  }
  if (q) {
    filtered = filtered.filter(c => 
      (c.ticketId && c.ticketId.toLowerCase().includes(q)) ||
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.studentName && c.studentName.toLowerCase().includes(q)) ||
      (c.studentId && c.studentId.toLowerCase().includes(q)) ||
      (c.department && c.department.toLowerCase().includes(q)) ||
      (c.assignedFacultyName && c.assignedFacultyName.toLowerCase().includes(q)) ||
      (c.location && c.location.toLowerCase().includes(q))
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
        <span style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">
          ${escapeHtml(c.assignedFacultyName || 'Unassigned')}
        </span>
      </td>
      <td>${renderStatusBadge(c.status)}</td>
      <td>
        <div style="display:flex; gap:0.4rem;">
          <a href="${resolveUrl('/admin/detail.html?id=' + c.id)}" class="btn btn-outline btn-sm" title="Full Timeline View">
            <i class="fa-solid fa-eye"></i> View
          </a>
          <button 
            class="btn btn-primary btn-sm triage-btn" 
            data-id="${c.id}" 
            data-status="${c.status}" 
            data-faculty="${c.assignedFacultyId || ''}" 
            data-remarks="${escapeHtml(c.adminRemarks || '')}"
          >
            <i class="fa-solid fa-list-check"></i> Triage
          </button>
        </div>
      </td>
    </tr>
  `).join('');

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
}

function initFilterEvents() {
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('status-filter');
  const categoryFilter = document.getElementById('category-filter');
  const urgencyFilter = document.getElementById('urgency-filter');
  const facultyFilter = document.getElementById('faculty-filter');

  if (searchInput) searchInput.addEventListener('input', applyFiltersAndRender);
  if (statusFilter) statusFilter.addEventListener('change', applyFiltersAndRender);
  if (categoryFilter) categoryFilter.addEventListener('change', applyFiltersAndRender);
  if (urgencyFilter) urgencyFilter.addEventListener('change', applyFiltersAndRender);
  if (facultyFilter) facultyFilter.addEventListener('change', applyFiltersAndRender);
}

function openTriageModal(data) {
  const modalOverlay = document.getElementById('triage-modal-overlay');
  const statusSelect = document.getElementById('modal-status-select');
  const facultySelect = document.getElementById('modal-faculty-select');
  const remarksInput = document.getElementById('modal-remarks-input');

  if (statusSelect) statusSelect.value = data.status || 'Submitted';
  if (facultySelect) facultySelect.value = data.facultyId || '';
  if (remarksInput) remarksInput.value = data.remarks || '';

  if (modalOverlay) {
    modalOverlay.style.display = 'flex';
    modalOverlay.classList.add('active');
  }
}

function closeTriageModal() {
  const modalOverlay = document.getElementById('triage-modal-overlay');
  if (modalOverlay) {
    modalOverlay.classList.remove('active');
    modalOverlay.style.display = 'none';
  }
  activeSelectedComplaintId = null;
}

function initModalEvents() {
  const modalOverlay = document.getElementById('triage-modal-overlay');
  document.querySelectorAll('.close-modal-trigger').forEach(b => b.addEventListener('click', closeTriageModal));
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeTriageModal();
    });
  }

  const triageForm = document.getElementById('triage-form');
  if (triageForm) {
    triageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeSelectedComplaintId) return;

      const status = triageForm.status.value;
      const facultyId = triageForm.facultyId.value;
      const remarks = triageForm.remarks.value.trim();

      let facultyName = 'Unassigned';
      if (facultyId) {
        const found = allFacultyList.find(f => f.uid === facultyId);
        facultyName = found ? (found.fullName || found.name) : 'Faculty';
      }

      try {
        showLoader('Updating complaint triage status...');
        
        if (facultyId && status === 'Assigned') {
          await assignComplaintToFaculty(activeSelectedComplaintId, adminUserObj, facultyId, facultyName, remarks);
        } else {
          await updateComplaintStatus(activeSelectedComplaintId, adminUserObj, status, remarks, facultyName);
        }

        hideLoader();
        showToast('Complaint status updated successfully!', 'success');
        closeTriageModal();
      } catch (err) {
        hideLoader();
        console.error('Triage update error:', err);
        showToast('Failed to update complaint status.', 'error');
      }
    });
  }
}

function initExportBtn() {
  const btn = document.getElementById('export-csv-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try {
      showLoader('Generating CSV export...');
      await exportComplaintsReport(currentComplaintsList);
      hideLoader();
      showToast('Export report downloaded!', 'success');
    } catch (e) {
      hideLoader();
      showToast(e.message || 'Export failed.', 'error');
    }
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
