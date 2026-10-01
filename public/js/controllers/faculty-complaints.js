/* ==========================================================================
   CampusCare - Faculty Assigned Complaints List Controller
   ========================================================================== */

import { requireRole, resolveUrl } from '../utils/guards.js';
import { 
  getAssignedComplaints,
  listenToFacultyComplaints,
  acceptComplaint,
  startWork,
  updateComplaintProgress,
  markComplaintResolved,
  requestReassignment
} from '../services/complaint.service.js';
import { formatDate, renderStatusBadge, renderUrgencyBadge } from '../utils/formatters.js';
import { initNotificationDropdown } from '../utils/notification-dropdown.js';
import { showToast } from '../utils/toast.js';
import { showLoader, hideLoader } from '../utils/loader.js';

let currentFacultyUser = null;
let currentComplaintsList = [];
let activeModalComplaint = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { user, profile } = await requireRole('faculty');
    currentFacultyUser = profile;

    renderFacultyProfile(profile);
    initNotificationDropdown(user.uid);

    // Subscribe to realtime stream of assigned complaints
    listenToFacultyComplaints(user.uid, (updatedList) => {
      currentComplaintsList = updatedList;
      applyFiltersAndRender();
    });

    initFilterEvents();
    initModalEvents();
  } catch (err) {
    console.error('Faculty complaints init error:', err);
  }
});

function renderFacultyProfile(profile) {
  const nameEl = document.getElementById('faculty-sidebar-name');
  const deptEl = document.getElementById('faculty-sidebar-dept');
  const avatarEl = document.getElementById('sidebar-avatar');

  const fullName = profile.fullName || 'Prof. Sarah Jenkins';
  const deptName = profile.department || 'Computer Science & Engineering';

  if (nameEl) nameEl.textContent = fullName;
  if (deptEl) deptEl.textContent = deptName;

  if (avatarEl) {
    const initial = fullName.charAt(0).toUpperCase();
    if (profile.photoURL) {
      avatarEl.innerHTML = `<img src="${profile.photoURL}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.onerror=null; this.parentElement.textContent='${initial}';" />`;
    } else {
      avatarEl.textContent = initial;
    }
  }
}

function applyFiltersAndRender() {
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('status-filter');
  const categoryFilter = document.getElementById('category-filter');
  const priorityFilter = document.getElementById('priority-filter');

  const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const statusVal = statusFilter ? statusFilter.value : 'ALL';
  const categoryVal = categoryFilter ? categoryFilter.value : 'ALL';
  const priorityVal = priorityFilter ? priorityFilter.value : 'ALL';

  let list = [...currentComplaintsList];

  if (statusVal !== 'ALL') {
    list = list.filter(c => c.status === statusVal);
  }
  if (categoryVal !== 'ALL') {
    list = list.filter(c => c.category === categoryVal);
  }
  if (priorityVal !== 'ALL') {
    list = list.filter(c => {
      const p = c.priority || c.urgency || '';
      return p.toLowerCase() === priorityVal.toLowerCase();
    });
  }
  if (searchQuery) {
    list = list.filter(c => 
      (c.ticketId && c.ticketId.toLowerCase().includes(searchQuery)) ||
      (c.title && c.title.toLowerCase().includes(searchQuery)) ||
      (c.studentName && c.studentName.toLowerCase().includes(searchQuery)) ||
      (c.location && c.location.toLowerCase().includes(searchQuery)) ||
      (c.category && c.category.toLowerCase().includes(searchQuery))
    );
  }

  const countEl = document.getElementById('results-count');
  if (countEl) countEl.textContent = `${list.length} complaint${list.length === 1 ? '' : 's'} assigned to you`;

  renderComplaintsTable(list);
}

function renderComplaintsTable(list) {
  const tbody = document.getElementById('faculty-complaints-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:3rem; color:var(--text-muted);">
          No assigned complaints found matching criteria.
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
        <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(c.studentName || 'Student')}</div>
        <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(c.department || '')}</div>
      </td>
      <td><span class="badge" style="background:var(--border-light); color:var(--text-primary);">${escapeHtml(c.category || 'General')}</span></td>
      <td>${renderUrgencyBadge(c.priority || c.urgency)}</td>
      <td>${renderStatusBadge(c.status)}</td>
      <td>
        <div class="btn-action-group">
          <a href="${resolveUrl('/faculty/detail.html?id=' + c.id)}" class="btn btn-outline btn-sm" title="View Full Details">
            <i class="fa-solid fa-eye"></i> View
          </a>
          <button class="btn btn-primary btn-sm action-btn" data-id="${c.id}" title="Take Action">
            <i class="fa-solid fa-bolt"></i> Action
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const comp = currentComplaintsList.find(c => c.id === id);
      if (comp) {
        let defAct = 'note';
        if (comp.status === 'Assigned') defAct = 'accept';
        else if (comp.status === 'Accepted') defAct = 'start';
        else if (comp.status === 'In Progress') defAct = 'resolve';
        openActionModal(comp, defAct);
      }
    });
  });
}

function initFilterEvents() {
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('status-filter');
  const categoryFilter = document.getElementById('category-filter');
  const priorityFilter = document.getElementById('priority-filter');

  if (searchInput) searchInput.addEventListener('input', applyFiltersAndRender);
  if (statusFilter) statusFilter.addEventListener('change', applyFiltersAndRender);
  if (categoryFilter) categoryFilter.addEventListener('change', applyFiltersAndRender);
  if (priorityFilter) priorityFilter.addEventListener('change', applyFiltersAndRender);
}

function openActionModal(complaint, defaultAction = 'note') {
  activeModalComplaint = complaint;
  const modal = document.getElementById('faculty-action-modal');
  const titleEl = document.getElementById('modal-ticket-title');
  const infoEl = document.getElementById('modal-ticket-info');
  const actionSelect = document.getElementById('action-type-select');
  const notesEl = document.getElementById('action-notes');
  const evidenceGroup = document.getElementById('evidence-group');

  if (titleEl) titleEl.textContent = `Action on ${complaint.ticketId}`;
  if (infoEl) {
    infoEl.innerHTML = `
      <div style="font-weight:700; color:var(--text-primary); margin-bottom:0.25rem;">${escapeHtml(complaint.title)}</div>
      <div style="color:var(--text-muted); font-size:0.78rem;">
        <span style="margin-right:0.75rem;"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(complaint.location || 'N/A')}</span>
        <span><i class="fa-solid fa-user"></i> ${escapeHtml(complaint.studentName)}</span>
      </div>
    `;
  }

  if (actionSelect) actionSelect.value = defaultAction;
  if (notesEl) {
    if (defaultAction === 'accept') notesEl.value = 'Assignment accepted. Site inspection underway.';
    else if (defaultAction === 'start') notesEl.value = 'Onsite repair work started.';
    else if (defaultAction === 'resolve') notesEl.value = 'Issue resolved and functional.';
    else notesEl.value = '';
  }

  if (evidenceGroup) {
    evidenceGroup.style.display = defaultAction === 'resolve' ? 'block' : 'none';
  }

  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
  }
}

function initModalEvents() {
  const modal = document.getElementById('faculty-action-modal');
  const closeBtn = document.getElementById('close-modal-btn');
  const cancelBtn = document.getElementById('cancel-modal-btn');
  const form = document.getElementById('faculty-action-form');
  const actionSelect = document.getElementById('action-type-select');
  const evidenceGroup = document.getElementById('evidence-group');

  const closeModal = () => {
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
    activeModalComplaint = null;
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (actionSelect) {
    actionSelect.addEventListener('change', () => {
      const act = actionSelect.value;
      if (evidenceGroup) {
        evidenceGroup.style.display = act === 'resolve' ? 'block' : 'none';
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeModalComplaint || !currentFacultyUser) return;

      const action = actionSelect.value;
      const notes = document.getElementById('action-notes').value.trim();
      const fileInput = document.getElementById('resolution-file-input');
      const evidenceFile = (fileInput && fileInput.files.length > 0) ? fileInput.files[0] : null;

      try {
        showLoader('Processing complaint action...');

        if (action === 'accept') {
          await acceptComplaint(activeModalComplaint.id, currentFacultyUser, notes);
          showToast(`Complaint ${activeModalComplaint.ticketId} accepted!`, 'success');
        } else if (action === 'start') {
          await startWork(activeModalComplaint.id, currentFacultyUser, notes);
          showToast(`Work started on ticket ${activeModalComplaint.ticketId}!`, 'info');
        } else if (action === 'note') {
          await updateComplaintProgress(activeModalComplaint.id, currentFacultyUser, notes);
          showToast('Progress note logged to timeline.', 'success');
        } else if (action === 'resolve') {
          await markComplaintResolved(activeModalComplaint.id, currentFacultyUser, notes, evidenceFile);
          showToast(`Complaint ${activeModalComplaint.ticketId} marked as Resolved!`, 'success');
        } else if (action === 'reassign') {
          await requestReassignment(activeModalComplaint.id, currentFacultyUser, notes);
          showToast('Reassignment request sent to Central Admin.', 'warning');
        }

        // Immediately reload list locally for snappy UX
        const updatedList = await getAssignedComplaints(currentFacultyUser.uid);
        if (updatedList) {
          currentComplaintsList = updatedList;
          applyFiltersAndRender();
        }

        hideLoader();
        closeModal();
      } catch (err) {
        hideLoader();
        console.error('Faculty action error:', err);
        showToast(err.message || 'Failed to update complaint.', 'error');
      }
    });
  }
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
