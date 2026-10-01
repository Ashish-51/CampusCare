/* ==========================================================================
   CampusCare - Complaint Details & Timeline Controller
   Unified Controller for Student & Admin with Role-Aware Actions
   ========================================================================== */

import { requireAuth, resolveUrl } from '../utils/guards.js';
import { 
  getComplaintDetails, 
  submitComplaintFeedback, 
  listenToComplaintDetails,
  cancelComplaint,
  reopenComplaint,
  assignComplaintToFaculty,
  reassignComplaint,
  closeComplaint,
  rejectComplaint,
  reopenComplaintByAdmin,
  addAdminNote
} from '../services/complaint.service.js';
import { getAllFaculty } from '../services/user.service.js';
import { formatDate, renderStatusBadge, renderUrgencyBadge } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';
import { showLoader, hideLoader } from '../utils/loader.js';

let currentComplaintId = null;
let currentRating = 5;
let loadedComplaintData = null;
let currentUser = null;
let currentProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const authData = await requireAuth();
    currentUser = authData.user;
    currentProfile = authData.profile;

    if (currentProfile.role === 'student') {
      const { initNotificationDropdown } = await import('../utils/notification-dropdown.js');
      initNotificationDropdown(currentUser.uid);
    }

    const urlParams = new URLSearchParams(window.location.search);
    currentComplaintId = urlParams.get('id');

    if (!currentComplaintId) {
      currentComplaintId = sessionStorage.getItem('cc_active_complaint_id');
    } else {
      sessionStorage.setItem('cc_active_complaint_id', currentComplaintId);
    }

    if (!currentComplaintId) {
      showToast('No complaint specified.', 'error');
      window.location.href = resolveUrl(currentProfile.role === 'admin' ? '/admin/dashboard.html' : '/student/dashboard.html');
      return;
    }

    // Ensure action modal markup exists in DOM
    ensureActionModalsExist();

    // Real-Time Firestore Listener for Single Complaint Document
    listenToComplaintDetails(currentComplaintId, (updatedComplaint) => {
      if (updatedComplaint) {
        loadedComplaintData = updatedComplaint;
        renderComplaintDetailsUI(updatedComplaint, currentProfile);
      }
    });

    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await loadComplaintDetails(currentProfile);
        showToast('Firestore details refreshed.', 'info');
      });
    }

    // 1. Print Ticket Handler
    const printBtn = document.getElementById('print-ticket-btn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        if (!loadedComplaintData) {
          showToast('Complaint data not loaded yet.', 'warning');
          return;
        }

        let printWrapper = document.getElementById('print-document-wrapper');
        if (!printWrapper) {
          printWrapper = document.createElement('div');
          printWrapper.id = 'print-document-wrapper';
          document.body.appendChild(printWrapper);
        }

        printWrapper.innerHTML = '';
        printWrapper.appendChild(buildPrintableDocumentElement(loadedComplaintData));

        window.print();
      });
    }

    // 2. Download PDF File Handler
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    if (downloadPdfBtn) {
      downloadPdfBtn.addEventListener('click', async () => {
        if (!loadedComplaintData) {
          showToast('Complaint data not loaded yet.', 'warning');
          return;
        }

        const ticketId = loadedComplaintData.ticketId || loadedComplaintData.id || 'CC-2026-0000';
        const docElem = buildPrintableDocumentElement(loadedComplaintData);

        // Invisible container within viewport for html2canvas layout rendering
        const renderContainer = document.createElement('div');
        renderContainer.style.cssText = 'position: absolute; left: 0; top: 0; width: 790px; height: 0; overflow: hidden;';
        docElem.style.width = '790px';
        renderContainer.appendChild(docElem);
        document.body.appendChild(renderContainer);

        if (window.html2pdf) {
          showToast('Generating official PDF document...', 'info');
          const opt = {
            margin:       [0.25, 0.25, 0.25, 0.25],
            filename:     `${ticketId}_Official_Report.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
          };
          try {
            await html2pdf().set(opt).from(docElem).save();
            showToast('Official PDF report downloaded successfully!', 'success');
          } catch (err) {
            console.error('PDF export error:', err);
            showToast('Failed to export PDF file.', 'error');
          } finally {
            if (renderContainer.parentNode) renderContainer.parentNode.removeChild(renderContainer);
          }
        } else {
          if (renderContainer.parentNode) renderContainer.parentNode.removeChild(renderContainer);
          showToast('PDF library fallback: Triggering print dialog.', 'warning');
          window.print();
        }
      });
    }

  } catch (err) {
    console.error('View complaint controller error:', err);
  }
});

/**
 * Fetch and Render Complaint Details from Firestore
 */
async function loadComplaintDetails(profile) {
  showLoader('Retrieving complaint details...');
  const complaint = await getComplaintDetails(currentComplaintId);
  hideLoader();

  if (!complaint) {
    showToast('Complaint document not found.', 'error');
    return;
  }

  renderComplaintDetailsUI(complaint, profile);
}

function renderComplaintDetailsUI(complaint, profile) {
  loadedComplaintData = complaint;

  // 1. Complaint ID (Ticket ID)
  const ticketIdEl = document.getElementById('complaint-ticket-id');
  if (ticketIdEl) ticketIdEl.textContent = complaint.ticketId || complaint.id;

  // 2. Status Badge & Priority Badge
  const statusBadgeEl = document.getElementById('complaint-status-badge');
  const priorityBadgeEl = document.getElementById('complaint-priority-badge') || document.getElementById('complaint-urgency-badge');
  if (statusBadgeEl) statusBadgeEl.innerHTML = renderStatusBadge(complaint.status);
  if (priorityBadgeEl) priorityBadgeEl.innerHTML = renderUrgencyBadge(complaint.urgency || complaint.priority);

  // 3. Title & Description
  const titleEl = document.getElementById('complaint-title');
  const descEl = document.getElementById('complaint-desc');
  if (titleEl) titleEl.textContent = complaint.title || 'Untitled Complaint';
  if (descEl) descEl.textContent = complaint.description || 'No description provided.';

  // 4. Student Info
  const studentNameEl = document.getElementById('meta-student-name') || document.getElementById('complaint-student-info');
  if (studentNameEl) {
    const studentName = complaint.studentName || (complaint.timeline && complaint.timeline[0] ? complaint.timeline[0].updatedByName : 'Student');
    const dept = complaint.department || 'General';
    studentNameEl.textContent = `${studentName} (${dept})`;
  }

  // 5. Category & Location
  const catEl = document.getElementById('meta-category') || document.getElementById('complaint-category');
  const locEl = document.getElementById('meta-location') || document.getElementById('complaint-location');
  if (catEl) catEl.textContent = complaint.category || 'General';
  if (locEl) locEl.textContent = complaint.location || 'N/A';

  // 6. Assigned Faculty
  const metaFacultyEl = document.getElementById('meta-faculty');
  if (metaFacultyEl) {
    const facName = complaint.assignedFacultyName || complaint.assignedTo;
    if (facName && facName !== 'Unassigned') {
      metaFacultyEl.innerHTML = `<span style="color:var(--color-brand); font-weight:700;"><i class="fa-solid fa-chalkboard-user"></i> ${escapeHtml(facName)}</span>`;
    } else {
      metaFacultyEl.innerHTML = `<span style="color:var(--text-muted); font-style:italic;">Unassigned</span>`;
    }
  }

  // 7. Created Date & Updated Date
  const createdDateEl = document.getElementById('meta-created-date') || document.getElementById('complaint-date');
  const updatedDateEl = document.getElementById('meta-updated-date');
  if (createdDateEl) createdDateEl.textContent = formatDate(complaint.createdAt);
  if (updatedDateEl) updatedDateEl.textContent = formatDate(complaint.updatedAt || complaint.createdAt);

  // 8. Admin Remarks Box
  const adminRemarksEl = document.getElementById('admin-remarks-box');
  if (adminRemarksEl) {
    if (complaint.adminRemarks && complaint.adminRemarks.trim() !== '') {
      adminRemarksEl.innerHTML = `
        <div style="background:var(--border-light); border:1px solid var(--border-color); padding:1.1rem; border-radius:var(--radius-md);">
          <h4 style="font-size:0.85rem; font-weight:800; color:var(--primary, var(--color-brand)); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.3rem;">
            <i class="fa-solid fa-user-shield"></i> Administration Remarks / Action Notes:
          </h4>
          <p style="font-size:0.92rem; color:var(--text-primary); margin-top:0.25rem;">${escapeHtml(complaint.adminRemarks)}</p>
          ${complaint.assignedFacultyName ? `<div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.4rem;">Assigned Faculty: <strong style="color:var(--text-primary);">${escapeHtml(complaint.assignedFacultyName)}</strong></div>` : ''}
        </div>
      `;
    } else {
      adminRemarksEl.innerHTML = '';
    }
  }

  // 9. Attached Photo Evidence (Student Upload)
  const imgContainer = document.getElementById('complaint-image-container');
  if (imgContainer) {
    if (complaint.imageUrl) {
      imgContainer.innerHTML = `
        <h4 style="font-size:0.85rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.5rem;">
          <i class="fa-solid fa-image"></i> Student Photo Evidence:
        </h4>
        <a href="${complaint.imageUrl}" target="_blank" rel="noopener">
          <img src="${complaint.imageUrl}" alt="Evidence Photo" class="evidence-image-preview" title="Click to open full resolution image" />
        </a>
      `;
    } else {
      imgContainer.innerHTML = `
        <div style="font-size:0.82rem; color:var(--text-muted); font-style:italic; padding:1rem; border:1px dashed var(--border-color); border-radius:var(--radius-md);">
          <i class="fa-solid fa-image-slash"></i> No student photo attached.
        </div>
      `;
    }
  }

  // 10. Resolution Photo Evidence (Faculty Upload)
  const resImgContainer = document.getElementById('resolution-image-container');
  if (resImgContainer) {
    if (complaint.resolutionImageUrl) {
      resImgContainer.innerHTML = `
        <h4 style="font-size:0.85rem; font-weight:700; color:var(--color-success); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.5rem;">
          <i class="fa-solid fa-circle-check"></i> Resolution Evidence Photo:
        </h4>
        <a href="${complaint.resolutionImageUrl}" target="_blank" rel="noopener">
          <img src="${complaint.resolutionImageUrl}" alt="Resolution Evidence Photo" class="evidence-image-preview" title="Click to open full resolution image" />
        </a>
      `;
    } else if (complaint.status === 'Resolved' || complaint.status === 'Closed') {
      resImgContainer.innerHTML = `
        <div style="font-size:0.82rem; color:var(--text-muted); font-style:italic; padding:1rem; border:1px dashed var(--border-color); border-radius:var(--radius-md);">
          <i class="fa-solid fa-circle-info"></i> Resolved without additional evidence photo.
        </div>
      `;
    } else {
      resImgContainer.innerHTML = '';
    }
  }

  // 11. Role-Specific Action Toolbars
  if (profile.role === 'student') {
    renderStudentActionsBar(complaint);
  } else if (profile.role === 'admin') {
    renderAdminActionsBar(complaint);
  }

  // 12. Timeline Sub-collection Events
  renderTimelineEvents(complaint.timeline || []);

  // 13. Post-Resolution Feedback Section
  renderFeedbackSection(complaint, profile);
}

/**
 * Render Student Action Bar (Cancel or Reopen)
 */
function renderStudentActionsBar(complaint) {
  const bar = document.getElementById('student-actions-bar');
  if (!bar) return;

  const status = complaint.status;
  const isCancellable = ['Submitted', 'Assigned'].includes(status);
  const isReopenable = ['Resolved', 'Closed'].includes(status);

  if (!isCancellable && !isReopenable) {
    bar.innerHTML = '';
    return;
  }

  bar.innerHTML = `
    <div style="background:var(--bg-surface-raised); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:1rem 1.25rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
      <div>
        <h4 style="font-size:0.9rem; font-weight:800; color:var(--text-primary); margin:0 0 0.25rem 0;">
          <i class="fa-solid fa-bolt" style="color:var(--color-brand);"></i> Student Action
        </h4>
        <p style="font-size:0.8rem; color:var(--text-muted); margin:0;">
          ${isCancellable ? 'You can cancel this ticket if it is no longer an issue.' : 'If the issue was not resolved properly, you can reopen this ticket.'}
        </p>
      </div>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        ${isCancellable ? `
          <button class="btn btn-outline btn-sm" id="btn-student-cancel" style="color:var(--color-danger); border-color:var(--color-danger);">
            <i class="fa-solid fa-ban"></i> Cancel Complaint
          </button>
        ` : ''}
        ${isReopenable ? `
          <button class="btn btn-outline btn-sm" id="btn-student-reopen" style="color:var(--color-warning); border-color:var(--color-warning);">
            <i class="fa-solid fa-rotate-left"></i> Reopen Ticket
          </button>
        ` : ''}
      </div>
    </div>
  `;

  const cancelBtn = document.getElementById('btn-student-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      openActionModal({
        action: 'student-cancel',
        title: 'Cancel Complaint Ticket',
        description: 'Are you sure you want to cancel this complaint? Please state the reason.',
        placeholder: 'Reason for cancellation (optional)...',
        confirmText: 'Confirm Cancellation',
        confirmColor: 'var(--color-danger)'
      });
    });
  }

  const reopenBtn = document.getElementById('btn-student-reopen');
  if (reopenBtn) {
    reopenBtn.addEventListener('click', () => {
      openActionModal({
        action: 'student-reopen',
        title: 'Reopen Unresolved Ticket',
        description: 'Please describe why the issue remains unresolved or what problem persists.',
        placeholder: 'Explain what part of the issue is still unresolved *',
        confirmText: 'Reopen Complaint',
        confirmColor: 'var(--color-warning)',
        requireReason: true
      });
    });
  }
}

/**
 * Render Admin Action Toolbar (Assign/Reassign, Verify & Close, Reject, Reopen, Add Note)
 */
function renderAdminActionsBar(complaint) {
  const bar = document.getElementById('admin-actions-bar');
  if (!bar) return;

  const status = complaint.status;
  const isAssigned = !!complaint.assignedFacultyId;
  const isResolvable = status === 'Resolved';
  const isRejectable = ['Submitted', 'Assigned'].includes(status);
  const isReopenable = ['Closed', 'Rejected'].includes(status);

  bar.innerHTML = `
    <div style="background:var(--bg-surface-raised); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:1.25rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem; flex-wrap:wrap; gap:0.5rem;">
        <h4 style="font-size:0.95rem; font-weight:800; color:var(--text-primary); margin:0; display:flex; align-items:center; gap:0.5rem;">
          <i class="fa-solid fa-user-shield" style="color:var(--color-brand);"></i> Administration Action Controls
        </h4>
        <span style="font-size:0.8rem; color:var(--text-muted);">
          Current Stage: <strong style="color:var(--text-primary);">${escapeHtml(status)}</strong>
        </span>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:0.6rem;">
        <button class="btn btn-primary btn-sm" id="btn-admin-assign">
          <i class="fa-solid fa-chalkboard-user"></i> ${isAssigned ? 'Reassign Faculty' : 'Assign to Faculty'}
        </button>
        ${isResolvable ? `
          <button class="btn btn-sm" id="btn-admin-verify-close" style="background:var(--color-success); color:#fff; border:none; padding:0.45rem 0.9rem; font-weight:700; border-radius:var(--radius-sm); cursor:pointer;">
            <i class="fa-solid fa-circle-check"></i> Verify & Close Ticket
          </button>
        ` : ''}
        ${isRejectable ? `
          <button class="btn btn-outline btn-sm" id="btn-admin-reject" style="color:var(--color-danger); border-color:var(--color-danger);">
            <i class="fa-solid fa-xmark"></i> Reject Ticket
          </button>
        ` : ''}
        ${isReopenable ? `
          <button class="btn btn-outline btn-sm" id="btn-admin-reopen" style="color:var(--color-warning); border-color:var(--color-warning);">
            <i class="fa-solid fa-rotate-left"></i> Reopen Ticket
          </button>
        ` : ''}
        <button class="btn btn-outline btn-sm" id="btn-admin-note">
          <i class="fa-solid fa-comment-dots"></i> Add Admin Note
        </button>
      </div>
    </div>
  `;

  const assignBtn = document.getElementById('btn-admin-assign');
  if (assignBtn) {
    assignBtn.addEventListener('click', async () => {
      await openAssignFacultyModal(complaint);
    });
  }

  const closeBtn = document.getElementById('btn-admin-verify-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      openActionModal({
        action: 'admin-close',
        title: 'Verify & Close Complaint Ticket',
        description: 'Verify that faculty resolution has satisfied quality standards and mark this complaint Closed.',
        placeholder: 'Enter closing verification remarks (optional)...',
        confirmText: 'Verify & Close Ticket',
        confirmColor: 'var(--color-success)'
      });
    });
  }

  const rejectBtn = document.getElementById('btn-admin-reject');
  if (rejectBtn) {
    rejectBtn.addEventListener('click', () => {
      openActionModal({
        action: 'admin-reject',
        title: 'Reject Complaint Ticket',
        description: 'Provide an institutional reason for rejecting this complaint.',
        placeholder: 'Reason for rejection *',
        confirmText: 'Reject Complaint',
        confirmColor: 'var(--color-danger)',
        requireReason: true
      });
    });
  }

  const reopenBtn = document.getElementById('btn-admin-reopen');
  if (reopenBtn) {
    reopenBtn.addEventListener('click', () => {
      openActionModal({
        action: 'admin-reopen',
        title: 'Reopen Complaint Ticket',
        description: 'Reopen this ticket and move it back to Active Triage status.',
        placeholder: 'Reason for reopening *',
        confirmText: 'Reopen Ticket',
        confirmColor: 'var(--color-warning)',
        requireReason: true
      });
    });
  }

  const noteBtn = document.getElementById('btn-admin-note');
  if (noteBtn) {
    noteBtn.addEventListener('click', () => {
      openActionModal({
        action: 'admin-note',
        title: 'Add Administrative Action Note',
        description: 'This internal remark will be recorded in the official lifecycle timeline and remarks box.',
        placeholder: 'Enter administrative action note *',
        confirmText: 'Save Note',
        confirmColor: 'var(--color-brand)',
        requireReason: true
      });
    });
  }
}

/**
 * Ensure Generic Action Modal and Assign Faculty Modal exist in DOM
 */
function ensureActionModalsExist() {
  if (!document.getElementById('action-dialog-modal')) {
    const modalDiv = document.createElement('div');
    modalDiv.id = 'action-dialog-modal';
    modalDiv.className = 'modal-backdrop';
    modalDiv.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center; padding:1rem; backdrop-filter:blur(4px);';
    modalDiv.innerHTML = `
      <div class="card" style="max-width:500px; width:100%; background:var(--bg-surface); border:1px solid var(--border-color); box-shadow:var(--shadow-xl); border-radius:var(--radius-lg);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid var(--border-color); padding-bottom:0.75rem;">
          <h3 id="modal-dialog-title" style="font-size:1.15rem; font-weight:800; margin:0; color:var(--text-primary);">Action</h3>
          <button type="button" id="modal-dialog-close-btn" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.2rem;">&times;</button>
        </div>
        <p id="modal-dialog-desc" style="font-size:0.88rem; color:var(--text-secondary); margin-bottom:1rem;"></p>
        <form id="modal-dialog-form">
          <input type="hidden" id="modal-dialog-action-type" />
          <div class="form-group" style="margin-bottom:1.25rem;">
            <textarea id="modal-dialog-textarea" class="form-control" style="min-height:90px; width:100%;" placeholder="Enter notes..."></textarea>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
            <button type="button" id="modal-dialog-cancel-btn" class="btn btn-outline btn-sm">Cancel</button>
            <button type="submit" id="modal-dialog-confirm-btn" class="btn btn-primary btn-sm">Confirm</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modalDiv);

    const close = () => { modalDiv.style.display = 'none'; };
    document.getElementById('modal-dialog-close-btn').addEventListener('click', close);
    document.getElementById('modal-dialog-cancel-btn').addEventListener('click', close);

    document.getElementById('modal-dialog-form').addEventListener('submit', handleActionModalSubmit);
  }

  // Assign Faculty Modal
  if (!document.getElementById('assign-faculty-dialog-modal')) {
    const assignModal = document.createElement('div');
    assignModal.id = 'assign-faculty-dialog-modal';
    assignModal.className = 'modal-backdrop';
    assignModal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center; padding:1rem; backdrop-filter:blur(4px);';
    assignModal.innerHTML = `
      <div class="card" style="max-width:520px; width:100%; background:var(--bg-surface); border:1px solid var(--border-color); box-shadow:var(--shadow-xl); border-radius:var(--radius-lg);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid var(--border-color); padding-bottom:0.75rem;">
          <h3 style="font-size:1.15rem; font-weight:800; margin:0; color:var(--text-primary);"><i class="fa-solid fa-chalkboard-user" style="color:var(--color-brand);"></i> Assign Faculty In-Charge</h3>
          <button type="button" id="assign-modal-close-btn" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.2rem;">&times;</button>
        </div>
        <form id="assign-faculty-form">
          <div class="form-group" style="margin-bottom:1rem;">
            <label class="form-label" style="font-weight:700; font-size:0.85rem;">Select Faculty Member *</label>
            <select id="assign-faculty-select" class="form-select" required style="width:100%;">
              <option value="">Loading faculty roster...</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:1.25rem;">
            <label class="form-label" style="font-weight:700; font-size:0.85rem;">Assignment Instructions / Remarks</label>
            <textarea id="assign-faculty-notes" class="form-control" style="min-height:85px; width:100%;" placeholder="e.g. Please inspect electrical socket and replace circuit breaker..."></textarea>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
            <button type="button" id="assign-modal-cancel-btn" class="btn btn-outline btn-sm">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm"><i class="fa-solid fa-check"></i> Assign Faculty</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(assignModal);

    const closeAssign = () => { assignModal.style.display = 'none'; };
    document.getElementById('assign-modal-close-btn').addEventListener('click', closeAssign);
    document.getElementById('assign-modal-cancel-btn').addEventListener('click', closeAssign);

    document.getElementById('assign-faculty-form').addEventListener('submit', handleAssignFacultySubmit);
  }
}

let activeModalConfig = null;

function openActionModal(config) {
  activeModalConfig = config;
  const modal = document.getElementById('action-dialog-modal');
  const title = document.getElementById('modal-dialog-title');
  const desc = document.getElementById('modal-dialog-desc');
  const type = document.getElementById('modal-dialog-action-type');
  const textarea = document.getElementById('modal-dialog-textarea');
  const confirmBtn = document.getElementById('modal-dialog-confirm-btn');

  if (title) title.textContent = config.title;
  if (desc) desc.textContent = config.description;
  if (type) type.value = config.action;
  if (textarea) {
    textarea.value = '';
    textarea.placeholder = config.placeholder || 'Enter notes...';
    textarea.required = !!config.requireReason;
  }
  if (confirmBtn) {
    confirmBtn.textContent = config.confirmText || 'Confirm';
    if (config.confirmColor) {
      confirmBtn.style.background = config.confirmColor;
      confirmBtn.style.borderColor = config.confirmColor;
    } else {
      confirmBtn.style.background = 'var(--color-brand)';
      confirmBtn.style.borderColor = 'var(--color-brand)';
    }
  }

  if (modal) modal.style.display = 'flex';
}

async function handleActionModalSubmit(e) {
  e.preventDefault();
  const modal = document.getElementById('action-dialog-modal');
  const actionType = document.getElementById('modal-dialog-action-type').value;
  const text = document.getElementById('modal-dialog-textarea').value.trim();

  if (activeModalConfig && activeModalConfig.requireReason && !text) {
    showToast('Please provide a reason or note.', 'warning');
    return;
  }

  const actorUser = {
    uid: currentUser.uid,
    fullName: currentProfile.fullName || currentProfile.name || (currentProfile.role === 'admin' ? 'Administrator' : 'Student'),
    email: currentUser.email,
    role: currentProfile.role
  };

  try {
    showLoader('Processing action...');

    if (actionType === 'student-cancel') {
      await cancelComplaint(currentComplaintId, actorUser, text);
      showToast('Complaint successfully cancelled.', 'success');
    } else if (actionType === 'student-reopen') {
      await reopenComplaint(currentComplaintId, actorUser, text);
      showToast('Complaint reopened for further review.', 'success');
    } else if (actionType === 'admin-close') {
      await closeComplaint(currentComplaintId, actorUser, text);
      showToast('Complaint verified and marked as Closed.', 'success');
    } else if (actionType === 'admin-reject') {
      await rejectComplaint(currentComplaintId, actorUser, text);
      showToast('Complaint rejected.', 'warning');
    } else if (actionType === 'admin-reopen') {
      await reopenComplaintByAdmin(currentComplaintId, actorUser, text);
      showToast('Complaint reopened by admin.', 'success');
    } else if (actionType === 'admin-note') {
      await addAdminNote(currentComplaintId, actorUser, text);
      showToast('Admin note recorded to timeline.', 'success');
    }

    hideLoader();
    if (modal) modal.style.display = 'none';
  } catch (err) {
    hideLoader();
    console.error('Action error:', err);
    showToast(err.message || 'Action failed.', 'error');
  }
}

async function openAssignFacultyModal(complaint) {
  const modal = document.getElementById('assign-faculty-dialog-modal');
  const select = document.getElementById('assign-faculty-select');
  const notes = document.getElementById('assign-faculty-notes');

  if (notes) notes.value = complaint.adminRemarks || '';
  if (modal) modal.style.display = 'flex';

  try {
    select.innerHTML = '<option value="">Loading faculty roster...</option>';
    const facultyList = await getAllFaculty();
    
    if (!facultyList || facultyList.length === 0) {
      select.innerHTML = '<option value="">No faculty members registered.</option>';
      return;
    }

    select.innerHTML = `
      <option value="">-- Choose Faculty In-Charge --</option>
      ${facultyList.map(f => {
        const isCurrent = (complaint.assignedFacultyId === f.uid || complaint.assignedFacultyId === f.id);
        return `
          <option value="${f.uid || f.id}" data-name="${escapeHtml(f.fullName || f.name || 'Faculty Member')}" ${isCurrent ? 'selected' : ''}>
            ${escapeHtml(f.fullName || f.name || 'Faculty')} (${escapeHtml(f.department || 'General')}) ${f.facultyId ? `[${f.facultyId}]` : ''}
          </option>
        `;
      }).join('')}
    `;
  } catch (err) {
    console.error('Load faculty error:', err);
    select.innerHTML = '<option value="">Failed to load faculty roster</option>';
  }
}

async function handleAssignFacultySubmit(e) {
  e.preventDefault();
  const modal = document.getElementById('assign-faculty-dialog-modal');
  const select = document.getElementById('assign-faculty-select');
  const notes = document.getElementById('assign-faculty-notes').value.trim();

  const selectedFacultyId = select.value;
  if (!selectedFacultyId) {
    showToast('Please select a faculty member.', 'warning');
    return;
  }

  const selectedOption = select.options[select.selectedIndex];
  const facultyName = selectedOption.getAttribute('data-name') || selectedOption.textContent.trim();

  const adminActor = {
    uid: currentUser.uid,
    fullName: currentProfile.fullName || currentProfile.name || 'Central Administrator',
    email: currentUser.email,
    role: 'admin'
  };

  try {
    showLoader(`Assigning ticket to ${facultyName}...`);
    
    if (loadedComplaintData && loadedComplaintData.assignedFacultyId) {
      await reassignComplaint(currentComplaintId, adminActor, selectedFacultyId, facultyName, notes);
      showToast(`Complaint reassigned to ${facultyName}`, 'success');
    } else {
      await assignComplaintToFaculty(currentComplaintId, adminActor, selectedFacultyId, facultyName, notes);
      showToast(`Complaint assigned to ${facultyName}`, 'success');
    }

    hideLoader();
    if (modal) modal.style.display = 'none';
  } catch (err) {
    hideLoader();
    console.error('Assign error:', err);
    showToast(err.message || 'Failed to assign faculty.', 'error');
  }
}

/**
 * Render Step-by-Step Timeline Events
 */
function renderTimelineEvents(timeline) {
  const container = document.getElementById('timeline-container');
  if (!container) return;

  if (!timeline || timeline.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:0.88rem;">No timeline updates recorded yet.</p>';
    return;
  }

  container.innerHTML = `
    <div class="timeline">
      ${timeline.map((ev, index) => `
        <div class="timeline-item ${index === timeline.length - 1 ? 'active' : ''}">
          <div class="timeline-badge"></div>
          <div class="timeline-content">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.25rem;">
              <span class="timeline-title">${escapeHtml(ev.title || 'Event')}</span>
              <span class="timeline-date">${formatDate(ev.timestamp)}</span>
            </div>
            ${ev.note ? `<div class="timeline-note">${escapeHtml(ev.note)}</div>` : ''}
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.35rem;">
              <i class="fa-solid fa-user-check"></i> ${escapeHtml(ev.performedByName || ev.updatedByName || 'System')} (${escapeHtml(ev.performedByRole || ev.updatedByRole || 'admin')})
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Render Resolution Rating Feedback Card
 */
function renderFeedbackSection(complaint, profile) {
  const feedbackCard = document.getElementById('feedback-section');
  const feedbackContent = document.getElementById('feedback-content');

  if (!feedbackCard || !feedbackContent) return;

  if (complaint.status === 'Resolved' && profile.role === 'student' && !complaint.feedback) {
    feedbackCard.style.display = 'block';
    feedbackContent.innerHTML = `
      <form id="feedback-form">
        <div class="form-group">
          <label class="form-label">Select Satisfaction Rating</label>
          <div class="star-rating star-rating-input">
            <span class="star selected" data-value="1">★</span>
            <span class="star selected" data-value="2">★</span>
            <span class="star selected" data-value="3">★</span>
            <span class="star selected" data-value="4">★</span>
            <span class="star selected" data-value="5">★</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="feedback-comment">Review Comments / Remarks</label>
          <textarea id="feedback-comment" name="comment" class="form-control" placeholder="Share your experience regarding maintenance staff service quality..." style="min-height:85px;"></textarea>
        </div>

        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-paper-plane"></i> Submit Feedback</button>
      </form>
    `;

    initStarRatingInput();
    initFeedbackFormSubmission();

  } else if (complaint.feedback) {
    feedbackCard.style.display = 'block';
    const rating = complaint.feedback.rating || 5;
    feedbackContent.innerHTML = `
      <div style="padding:1rem; background:var(--border-light); border-radius:var(--radius-md);">
        <div style="color:#f59e0b; font-size:1.4rem; margin-bottom:0.25rem;">
          ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}
        </div>
        <p style="font-size:0.92rem; color:var(--text-primary); font-style:italic;">"${escapeHtml(complaint.feedback.comment || 'No additional comment provided.')}"</p>
        <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.4rem;">Submitted on ${formatDate(complaint.feedback.submittedAt)}</div>
      </div>
    `;
  } else {
    feedbackCard.style.display = 'none';
  }
}

function initStarRatingInput() {
  const stars = document.querySelectorAll('.star-rating-input .star');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      currentRating = parseInt(star.dataset.value, 10);
      stars.forEach(s => {
        const val = parseInt(s.dataset.value, 10);
        if (val <= currentRating) {
          s.classList.add('selected');
        } else {
          s.classList.remove('selected');
        }
      });
    });
  });
}

function initFeedbackFormSubmission() {
  const form = document.getElementById('feedback-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const comment = form.comment.value.trim();

    try {
      showLoader('Submitting rating feedback...');
      await submitComplaintFeedback(currentComplaintId, currentRating, comment);
      hideLoader();
      showToast('Thank you for rating resolution quality!', 'success');
    } catch (err) {
      hideLoader();
      console.error('Feedback error:', err);
      showToast('Failed to submit feedback.', 'error');
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

/**
 * Generate Official Institutional Document Element for Print & PDF
 */
function buildPrintableDocumentElement(complaint) {
  const container = document.createElement('div');
  container.className = 'printable-document-root';
  container.style.cssText = `
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #0f172a;
    background: #ffffff;
    padding: 32px 36px;
    max-width: 800px;
    margin: 0 auto;
    box-sizing: border-box;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
  `;

  const ticketId = complaint.ticketId || complaint.id || 'CC-2026-0000';
  const studentName = complaint.studentName || (complaint.timeline && complaint.timeline[0] ? complaint.timeline[0].updatedByName : 'Student Account');
  const dept = complaint.department || 'General Department';
  const facultyName = complaint.assignedFacultyName || complaint.assignedTo || 'Unassigned';

  const statusColorMap = {
    'Submitted': { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    'Assigned': { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' },
    'Accepted': { bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc' },
    'In Progress': { bg: '#fefce8', color: '#a16207', border: '#fef08a' },
    'Resolved': { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
    'Closed': { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
    'Rejected': { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
    'Reopened': { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' }
  };
  const statusStyle = statusColorMap[complaint.status] || { bg: '#f8fafc', color: '#334155', border: '#cbd5e1' };

  container.innerHTML = `
    <!-- Header Bar -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 14px; margin-bottom: 18px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="background: #2563eb; color: #ffffff; width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px;">CC</div>
          <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.3px;">CampusCare Portal</h1>
        </div>
        <div style="font-size: 11px; color: #64748b; margin-top: 3px; font-weight: 600;">Official Maintenance Complaint & Audit Summary</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 15px; font-weight: 800; color: #2563eb; font-family: monospace; background: #eff6ff; padding: 4px 10px; border-radius: 6px; border: 1px solid #bfdbfe; display: inline-block;">${escapeHtml(ticketId)}</div>
        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Issued: ${formatDate(new Date().toISOString())}</div>
      </div>
    </div>

    <!-- Status & Urgency Bar -->
    <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 18px;">
      <div style="display: flex; align-items: center; gap: 14px; font-size: 12px;">
        <div><span style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 700; display: block;">Status</span><strong style="color: ${statusStyle.color}; font-size: 13px;">${escapeHtml(complaint.status || 'Submitted')}</strong></div>
        <div style="height: 20px; width: 1px; background: #cbd5e1;"></div>
        <div><span style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 700; display: block;">Urgency</span><strong style="color: #0f172a;">${escapeHtml(complaint.urgency || complaint.priority || 'Medium')}</strong></div>
        <div style="height: 20px; width: 1px; background: #cbd5e1;"></div>
        <div><span style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 700; display: block;">Category</span><strong style="color: #0f172a;">${escapeHtml(complaint.category || 'General')}</strong></div>
      </div>
      <div style="font-size: 11px; color: #64748b;">Lodged Date: <strong>${formatDate(complaint.createdAt)}</strong></div>
    </div>

    <!-- Metadata Grid -->
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 18px;">
      <tr>
        <td style="padding: 7px 10px; background: #f1f5f9; border: 1px solid #cbd5e1; font-weight: 700; color: #475569; width: 22%;">Student Name</td>
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; color: #0f172a; width: 28%; font-weight: 600;">${escapeHtml(studentName)}</td>
        <td style="padding: 7px 10px; background: #f1f5f9; border: 1px solid #cbd5e1; font-weight: 700; color: #475569; width: 22%;">Department</td>
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; color: #0f172a; width: 28%; font-weight: 600;">${escapeHtml(dept)}</td>
      </tr>
      <tr>
        <td style="padding: 7px 10px; background: #f1f5f9; border: 1px solid #cbd5e1; font-weight: 700; color: #475569;">Location</td>
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; color: #0f172a;">${escapeHtml(complaint.location || 'N/A')}</td>
        <td style="padding: 7px 10px; background: #f1f5f9; border: 1px solid #cbd5e1; font-weight: 700; color: #475569;">Assigned Faculty</td>
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; color: #0f172a; font-weight: 600;">${escapeHtml(facultyName)}</td>
      </tr>
    </table>

    <!-- Title & Description Section -->
    <div style="margin-bottom: 18px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
      <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Subject / Issue Title</div>
      <h2 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0 0 10px 0; line-height: 1.3;">${escapeHtml(complaint.title)}</h2>

      <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Detailed Description</div>
      <div style="font-size: 12px; line-height: 1.5; color: #334155; margin: 0; white-space: pre-line; background: #f8fafc; padding: 10px; border-radius: 4px; border: 1px solid #f1f5f9;">${escapeHtml(complaint.description || 'No description provided.')}</div>
    </div>

    <!-- Admin Remarks (if present) -->
    ${complaint.adminRemarks ? `
    <div style="margin-bottom: 18px; background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #2563eb; border-radius: 6px; padding: 12px 14px;">
      <div style="font-size: 10px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;">Administration Action Remarks</div>
      <div style="font-size: 12px; color: #1e3a8a; line-height: 1.4; font-weight: 500;">${escapeHtml(complaint.adminRemarks)}</div>
    </div>
    ` : ''}

    <!-- Photos Grid (Student Evidence & Resolution Evidence) -->
    ${(complaint.imageUrl || complaint.resolutionImageUrl) ? `
    <div style="display:grid; grid-template-columns:${complaint.imageUrl && complaint.resolutionImageUrl ? '1fr 1fr' : '1fr'}; gap:12px; margin-bottom: 18px; page-break-inside: avoid;">
      ${complaint.imageUrl ? `
      <div>
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Student Photo Evidence</div>
        <div style="text-align: center; background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <img src="${complaint.imageUrl}" style="max-width: 100%; max-height: 160px; object-fit: contain; border-radius: 4px; border: 1px solid #cbd5e1;" alt="Evidence Photo" />
        </div>
      </div>
      ` : ''}
      ${complaint.resolutionImageUrl ? `
      <div>
        <div style="font-size: 10px; font-weight: 700; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Resolution Photo Evidence</div>
        <div style="text-align: center; background: #f0fdf4; padding: 8px; border-radius: 6px; border: 1px solid #bbf7d0;">
          <img src="${complaint.resolutionImageUrl}" style="max-width: 100%; max-height: 160px; object-fit: contain; border-radius: 4px; border: 1px solid #86efac;" alt="Resolution Evidence" />
        </div>
      </div>
      ` : ''}
    </div>
    ` : ''}

    <!-- Audit Timeline Log -->
    <div style="margin-bottom: 18px; page-break-inside: avoid;">
      <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Lifecycle Audit & Progress History</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
        <thead>
          <tr style="background: #f1f5f9; text-align: left; color: #475569;">
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Status Stage</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Timestamp</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Action Notes</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Updated By</th>
          </tr>
        </thead>
        <tbody>
          ${(complaint.timeline || []).map(ev => `
            <tr>
              <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a;">${escapeHtml(ev.title || ev.status || 'Event')}</td>
              <td style="padding: 5px 8px; border: 1px solid #cbd5e1; color: #475569;">${formatDate(ev.timestamp)}</td>
              <td style="padding: 5px 8px; border: 1px solid #cbd5e1; color: #334155;">${escapeHtml(ev.note || '--')}</td>
              <td style="padding: 5px 8px; border: 1px solid #cbd5e1; color: #475569;">${escapeHtml(ev.performedByName || ev.updatedByName || 'System')} (${escapeHtml(ev.performedByRole || ev.updatedByRole || 'admin')})</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Student Feedback (if present) -->
    ${complaint.feedback ? `
    <div style="margin-bottom: 18px; background: #fefce8; border: 1px solid #fef08a; border-radius: 6px; padding: 10px 12px; page-break-inside: avoid;">
      <div style="font-size: 10px; font-weight: 700; color: #a16207; text-transform: uppercase; margin-bottom: 3px;">Student Resolution Rating & Feedback</div>
      <div style="color: #f59e0b; font-size: 13px; margin-bottom: 3px;">${'★'.repeat(complaint.feedback.rating || 5)}${'☆'.repeat(5 - (complaint.feedback.rating || 5))}</div>
      <div style="font-size: 11px; color: #713f12; font-style: italic;">"${escapeHtml(complaint.feedback.comment || 'No comment provided.')}"</div>
    </div>
    ` : ''}

    <!-- Official Footer -->
    <div style="border-top: 2px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; margin-top: 18px;">
      <div>CampusCare Digital Facility Management • Confidential Official Audit Record</div>
      <div>Page 1 of 1</div>
    </div>
  `;

  return container;
}
