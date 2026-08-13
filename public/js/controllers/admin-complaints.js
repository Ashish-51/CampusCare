/* ==========================================================================
   CampusCare - Admin Complaints Master Table & Status Triage Controller
   ========================================================================== */

import { requireAuth, resolveUrl } from '../utils/guards.js';
import { getAllComplaints, updateComplaintStatus, listenToAllComplaints } from '../services/complaint.service.js';
import { formatDate, renderStatusBadge, renderUrgencyBadge } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';
import { showLoader, hideLoader } from '../utils/loader.js';

let adminUserObj = null;
let currentComplaintsList = [];
let activeSelectedComplaintId = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { profile } = await requireAuth('admin');
    adminUserObj = profile;
    
    // Subscribe to Firestore Real-Time Stream
    listenToAllComplaints((updatedList) => {
      currentComplaintsList = updatedList;
      renderComplaintsTable(currentComplaintsList);
    });

    initFilterEvents();
    initModalEvents();
  } catch (err) {
    console.error('Admin complaints list init error:', err);
  }
});

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
        <div style="font-weight:700; color:var(--text-main);">${escapeHtml(c.title)}</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(c.location || 'N/A')}</div>
      </td>
      <td>
        <div>${escapeHtml(c.studentName)}</div>
        <div style="font-size:0.78rem; color:var(--text-muted);">${escapeHtml(c.department || 'Student')}</div>
      </td>
      <td><span class="badge" style="background:var(--border-light); color:var(--text-main);">${escapeHtml(c.category)}</span></td>
      <td>${renderUrgencyBadge(c.urgency)}</td>
      <td>${renderStatusBadge(c.status)}</td>
      <td>
        <div style="display:flex; gap:0.4rem;">
          <a href="${resolveUrl('/admin/detail.html?id=' + c.id)}" class="btn btn-outline btn-sm" title="Full Timeline View">👁 View</a>
          <button class="btn btn-primary btn-sm triage-btn" data-id="${c.id}" data-status="${c.status}" data-assigned="${escapeHtml(c.assignedTo || '')}" data-remarks="${escapeHtml(c.adminRemarks || '')}">Triage</button>
        </div>
      </td>
    </tr>
  `).join('');

  // Attach click listener for triage modal buttons
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
}

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
        showLoader('Updating complaint triage status...');
        await updateComplaintStatus(activeSelectedComplaintId, adminUserObj, status, remarks, assignedTo);
        hideLoader();
        showToast('Complaint status updated successfully!', 'success');
        closeTriageModal();
        await loadComplaints();
      } catch (err) {
        hideLoader();
        console.error('Triage update error:', err);
        showToast('Failed to update complaint status.', 'error');
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
