/* ==========================================================================
   CampusCare - Faculty Dashboard Controller
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

    // Listen to realtime assigned complaints
    listenToFacultyComplaints(user.uid, (updatedList) => {
      currentComplaintsList = updatedList;
      renderMetrics(currentComplaintsList);
      renderRecentTable(currentComplaintsList.slice(0, 10));
    });

    initModalEvents();
  } catch (err) {
    console.error('Faculty dashboard init error:', err);
  }
});

function renderFacultyProfile(profile) {
  const nameEl = document.getElementById('faculty-sidebar-name');
  const deptEl = document.getElementById('faculty-sidebar-dept');
  const welcomeEl = document.getElementById('welcome-faculty-name');
  const avatarEl = document.getElementById('sidebar-avatar');

  const fullName = profile.fullName || 'Prof. Sarah Jenkins';
  const deptName = profile.department || 'Computer Science & Engineering';

  if (nameEl) nameEl.textContent = fullName;
  if (deptEl) deptEl.textContent = deptName;
  if (welcomeEl) welcomeEl.textContent = fullName;

  if (avatarEl) {
    const initial = fullName.charAt(0).toUpperCase();
    if (profile.photoURL) {
      avatarEl.innerHTML = `<img src="${profile.photoURL}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.onerror=null; this.parentElement.textContent='${initial}';" />`;
    } else {
      avatarEl.textContent = initial;
    }
  }
}

function renderMetrics(list) {
  const total = list.length;
  const newCount = list.filter(c => c.status === 'Assigned').length;
  const inProgress = list.filter(c => c.status === 'In Progress' || c.status === 'Accepted').length;
  const resolved = list.filter(c => c.status === 'Resolved' || c.status === 'Closed').length;
  const pending = list.filter(c => c.status === 'Assigned' || c.status === 'Accepted' || c.status === 'In Progress' || c.status === 'Reopened').length;
  const reopened = list.filter(c => c.status === 'Reopened').length;

  const totalEl = document.getElementById('stat-total');
  const newEl = document.getElementById('stat-new');
  const inProgEl = document.getElementById('stat-inprogress');
  const resolvedEl = document.getElementById('stat-resolved');
  const pendingEl = document.getElementById('stat-pending');
  const reopenedEl = document.getElementById('stat-reopened');

  if (totalEl) totalEl.textContent = total;
  if (newEl) newEl.textContent = newCount;
  if (inProgEl) inProgEl.textContent = inProgress;
  if (resolvedEl) resolvedEl.textContent = resolved;
  if (pendingEl) pendingEl.textContent = pending;
  if (reopenedEl) reopenedEl.textContent = reopened;
}

function renderRecentTable(list) {
  const tbody = document.getElementById('faculty-recent-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:3rem; color:var(--text-muted);">
          <i class="fa-solid fa-inbox" style="font-size:2rem; margin-bottom:0.75rem; display:block; opacity:0.4;"></i>
          No complaints currently assigned to you. Enjoy your day!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(c => {
    let quickActionBtn = '';
    if (c.status === 'Assigned') {
      quickActionBtn = `
        <button class="btn btn-primary btn-sm accept-btn" data-id="${c.id}" title="Accept Assignment">
          <i class="fa-solid fa-check"></i> Accept
        </button>
      `;
    } else if (c.status === 'Accepted') {
      quickActionBtn = `
        <button class="btn btn-secondary btn-sm start-btn" data-id="${c.id}" title="Start Resolution Work">
          <i class="fa-solid fa-play"></i> Start Work
        </button>
      `;
    } else if (c.status === 'In Progress' || c.status === 'Reopened') {
      quickActionBtn = `
        <button class="btn btn-outline btn-sm action-modal-btn" data-id="${c.id}" title="Update Progress or Resolve">
          <i class="fa-solid fa-pen-to-square"></i> Update
        </button>
      `;
    }

    return `
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
            ${quickActionBtn}
            <a href="${resolveUrl('/faculty/detail.html?id=' + c.id)}" class="btn btn-outline btn-sm" title="View Full Details">
              <i class="fa-solid fa-eye"></i> View
            </a>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach quick action listeners
  tbody.querySelectorAll('.accept-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const comp = currentComplaintsList.find(c => c.id === id);
      if (comp) openActionModal(comp, 'accept');
    });
  });

  tbody.querySelectorAll('.start-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const comp = currentComplaintsList.find(c => c.id === id);
      if (comp) openActionModal(comp, 'start');
    });
  });

  tbody.querySelectorAll('.action-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const comp = currentComplaintsList.find(c => c.id === id);
      if (comp) openActionModal(comp, 'note');
    });
  });
}

function openActionModal(complaint, defaultAction = 'accept') {
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
    notesEl.value = defaultAction === 'accept' ? 'Assignment accepted. Proceeding with onsite inspection.' : 
                    (defaultAction === 'start' ? 'Onsite resolution work started.' : '');
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
      const notesEl = document.getElementById('action-notes');
      if (notesEl && !notesEl.value) {
        if (act === 'accept') notesEl.value = 'Assignment accepted. Proceeding with onsite inspection.';
        else if (act === 'start') notesEl.value = 'Resolution work initiated.';
        else if (act === 'resolve') notesEl.value = 'Issue resolved and verified functional.';
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

        // Instantly refresh complaints table and KPI stats
        const { getAssignedComplaints } = await import('../services/complaint.service.js');
        const refreshed = await getAssignedComplaints(currentFacultyUser.uid);
        if (refreshed) {
          currentComplaintsList = refreshed;
          renderMetrics(currentComplaintsList);
          renderRecentTable(currentComplaintsList.slice(0, 10));
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
