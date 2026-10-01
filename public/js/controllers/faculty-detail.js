/* ==========================================================================
   CampusCare - Faculty Complaint Detail & Resolution Controller
   ========================================================================== */

import { requireRole, resolveUrl } from '../utils/guards.js';
import { 
  getAssignedComplaintById, 
  listenToComplaintDetails,
  acceptComplaint,
  startWork,
  updateComplaintProgress,
  markComplaintResolved,
  requestReassignment
} from '../services/complaint.service.js';
import { formatDate, renderStatusBadge, renderUrgencyBadge } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';
import { showLoader, hideLoader } from '../utils/loader.js';

let currentComplaintId = null;
let currentFacultyProfile = null;
let loadedComplaintData = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { user, profile } = await requireRole('faculty');
    currentFacultyProfile = profile;

    const urlParams = new URLSearchParams(window.location.search);
    currentComplaintId = urlParams.get('id');

    if (!currentComplaintId) {
      showToast('No complaint specified.', 'error');
      window.location.href = resolveUrl('/faculty/complaints.html');
      return;
    }

    // Verify assignment and load initial data
    try {
      const initial = await getAssignedComplaintById(currentComplaintId, user.uid);
      if (!initial) {
        showToast('Complaint not found or not assigned to you.', 'error');
        window.location.href = resolveUrl('/faculty/complaints.html');
        return;
      }
      loadedComplaintData = initial;
      renderDetailUI(loadedComplaintData);
    } catch (err) {
      showToast(err.message || 'Access denied.', 'error');
      window.location.href = resolveUrl('/faculty/complaints.html');
      return;
    }

    // Subscribe to realtime updates on this document
    listenToComplaintDetails(currentComplaintId, (updated) => {
      if (updated) {
        loadedComplaintData = updated;
        renderDetailUI(updated);
      }
    });

    initModalEvents();
    initPrintAndPdf();
  } catch (err) {
    console.error('Faculty detail controller error:', err);
  }
});

function renderDetailUI(c) {
  // 1. Headers & Badges
  const ticketIdEl = document.getElementById('complaint-ticket-id');
  const statusBadgeEl = document.getElementById('complaint-status-badge');
  const priorityBadgeEl = document.getElementById('complaint-priority-badge');
  const titleEl = document.getElementById('complaint-title');

  if (ticketIdEl) ticketIdEl.textContent = c.ticketId || c.id;
  if (statusBadgeEl) statusBadgeEl.innerHTML = renderStatusBadge(c.status);
  if (priorityBadgeEl) priorityBadgeEl.innerHTML = renderUrgencyBadge(c.priority || c.urgency);
  if (titleEl) titleEl.textContent = c.title || 'Untitled Complaint';

  // 2. Metadata Grid
  const metaCat = document.getElementById('meta-category');
  const metaLoc = document.getElementById('meta-location');
  const metaStudent = document.getElementById('meta-student-name');
  const metaEmail = document.getElementById('meta-student-email');
  const metaDept = document.getElementById('meta-department');
  const metaDate = document.getElementById('meta-created-date');

  if (metaCat) metaCat.textContent = c.category || 'General';
  if (metaLoc) metaLoc.textContent = c.location || 'N/A';
  if (metaStudent) metaStudent.textContent = c.studentName || 'Student';
  if (metaEmail) metaEmail.textContent = c.studentEmail || 'N/A';
  if (metaDept) metaDept.textContent = c.department || 'General';
  if (metaDate) metaDate.textContent = formatDate(c.createdAt);

  // 3. Description
  const descEl = document.getElementById('complaint-desc');
  if (descEl) descEl.textContent = c.description || 'No description provided.';

  // 4. Admin Instructions Remarks
  const adminBox = document.getElementById('admin-remarks-box');
  if (adminBox) {
    if (c.adminRemarks) {
      adminBox.innerHTML = `
        <div style="background:var(--color-brand-soft); border:1px solid rgba(91,92,235,0.25); border-radius:var(--radius-md); padding:0.9rem 1rem;">
          <h5 style="margin:0 0 0.3rem 0; font-size:0.8rem; text-transform:uppercase; color:var(--color-brand); font-weight:800; display:flex; align-items:center; gap:0.4rem;">
            <i class="fa-solid fa-clipboard-check"></i> Central Admin Instructions:
          </h5>
          <p style="margin:0; font-size:0.88rem; color:var(--text-primary); line-height:1.45;">${escapeHtml(c.adminRemarks)}</p>
        </div>
      `;
    } else {
      adminBox.innerHTML = '';
    }
  }

  // 5. Evidence Photos
  const studentImgContainer = document.getElementById('complaint-image-container');
  if (studentImgContainer) {
    if (c.imageUrl) {
      studentImgContainer.innerHTML = `
        <h5 style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.5rem;">
          <i class="fa-solid fa-image"></i> Student Photo Evidence
        </h5>
        <a href="${c.imageUrl}" target="_blank" rel="noopener">
          <img src="${c.imageUrl}" alt="Student Evidence" class="evidence-image-preview" title="Click to view full image" />
        </a>
      `;
    } else {
      studentImgContainer.innerHTML = `
        <div style="font-size:0.82rem; color:var(--text-muted); padding:1rem; background:var(--bg-surface-raised); border-radius:var(--radius-md); border:1px dashed var(--border-color);">
          <i class="fa-solid fa-image-slash"></i> No student photo attached.
        </div>
      `;
    }
  }

  const resImgContainer = document.getElementById('resolution-image-container');
  if (resImgContainer) {
    if (c.resolutionImageUrl) {
      resImgContainer.innerHTML = `
        <h5 style="font-size:0.8rem; font-weight:700; color:var(--color-success); text-transform:uppercase; margin-bottom:0.5rem;">
          <i class="fa-solid fa-circle-check"></i> Resolution Evidence Photo
        </h5>
        <a href="${c.resolutionImageUrl}" target="_blank" rel="noopener">
          <img src="${c.resolutionImageUrl}" alt="Resolution Evidence" class="evidence-image-preview" title="Click to view full image" />
        </a>
      `;
    } else if (c.status === 'Resolved' || c.status === 'Closed') {
      resImgContainer.innerHTML = `
        <div style="font-size:0.82rem; color:var(--text-muted); padding:1rem; background:var(--bg-surface-raised); border-radius:var(--radius-md); border:1px dashed var(--border-color);">
          <i class="fa-solid fa-circle-info"></i> Resolved without additional photo.
        </div>
      `;
    } else {
      resImgContainer.innerHTML = '';
    }
  }

  // 6. Action Buttons Toolbar
  renderActionButtons(c);

  // 7. Student Rating / Feedback
  renderFeedback(c);

  // 8. Audit Log Timeline
  renderTimeline(c.timeline || []);
}

function renderActionButtons(c) {
  const container = document.getElementById('action-buttons-container');
  if (!container) return;

  const s = c.status;

  if (s === 'Submitted') {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; width:100%;">
        <div style="font-size:0.88rem; color:var(--text-secondary); display:flex; align-items:center; gap:0.5rem;">
          <i class="fa-solid fa-clock" style="color:var(--color-brand);"></i> Submitted by student. Awaiting Central Admin assignment, or you can accept and self-assign below.
        </div>
        <button class="btn btn-primary btn-sm" id="btn-action-accept">
          <i class="fa-solid fa-check"></i> Accept & Self-Assign Ticket
        </button>
      </div>
    `;
    const btnAccept = document.getElementById('btn-action-accept');
    if (btnAccept) {
      btnAccept.addEventListener('click', async () => {
        try {
          showLoader('Accepting complaint assignment...');
          await acceptComplaint(c.id, currentFacultyProfile, 'Accepted and self-assigned by faculty.');
          const updated = await getAssignedComplaintById(currentComplaintId, currentFacultyProfile.uid);
          if (updated) {
            loadedComplaintData = updated;
            renderDetailUI(updated);
          }
          hideLoader();
          showToast('Complaint accepted and assigned to you!', 'success');
        } catch (err) {
          hideLoader();
          showToast(err.message, 'error');
        }
      });
    }

  } else if (s === 'Assigned') {
    container.innerHTML = `
      <button class="btn btn-primary btn-sm" id="btn-action-accept">
        <i class="fa-solid fa-check-double"></i> Accept Assignment
      </button>
      <button class="btn btn-outline btn-sm" id="btn-action-reassign" style="color:var(--color-danger); border-color:var(--color-danger);">
        <i class="fa-solid fa-arrow-right-arrow-left"></i> Request Reassignment
      </button>
    `;
    document.getElementById('btn-action-accept').addEventListener('click', async () => {
      try {
        showLoader('Accepting complaint assignment...');
        await acceptComplaint(c.id, currentFacultyProfile, 'Accepted by faculty. Proceeding to inspection.');
        const updated = await getAssignedComplaintById(currentComplaintId, currentFacultyProfile.uid);
        if (updated) {
          loadedComplaintData = updated;
          renderDetailUI(updated);
        }
        hideLoader();
        showToast('Complaint accepted!', 'success');
      } catch (err) {
        hideLoader();
        showToast(err.message, 'error');
      }
    });
    document.getElementById('btn-action-reassign').addEventListener('click', () => {
      openModal('reassign', 'Request Reassignment from Admin', 'Explain why this complaint should be reassigned to another department...');
    });

  } else if (s === 'Accepted') {
    container.innerHTML = `
      <button class="btn btn-primary btn-sm" id="btn-action-start">
        <i class="fa-solid fa-play"></i> Start Work
      </button>
      <button class="btn btn-secondary btn-sm" id="btn-action-note">
        <i class="fa-solid fa-comment-dots"></i> Add Note
      </button>
      <button class="btn btn-outline btn-sm" id="btn-action-reassign" style="color:var(--color-danger); border-color:var(--color-danger);">
        <i class="fa-solid fa-arrow-right-arrow-left"></i> Request Reassignment
      </button>
    `;
    document.getElementById('btn-action-start').addEventListener('click', async () => {
      try {
        showLoader('Marking work started...');
        await startWork(c.id, currentFacultyProfile, 'Onsite resolution work started.');
        const updated = await getAssignedComplaintById(currentComplaintId, currentFacultyProfile.uid);
        if (updated) {
          loadedComplaintData = updated;
          renderDetailUI(updated);
        }
        hideLoader();
        showToast('Work started on complaint!', 'info');
      } catch (err) {
        hideLoader();
        showToast(err.message, 'error');
      }
    });
    document.getElementById('btn-action-note').addEventListener('click', () => {
      openModal('note', 'Add Faculty Progress Note', 'Enter note or milestone update for this ticket...');
    });
    document.getElementById('btn-action-reassign').addEventListener('click', () => {
      openModal('reassign', 'Request Reassignment from Admin', 'Explain why this complaint should be reassigned...');
    });

  } else if (s === 'In Progress' || s === 'Reopened') {
    container.innerHTML = `
      <button class="btn btn-primary btn-sm" id="btn-action-resolve">
        <i class="fa-solid fa-circle-check"></i> Mark as Resolved
      </button>
      <button class="btn btn-secondary btn-sm" id="btn-action-note">
        <i class="fa-solid fa-comment-dots"></i> Add Progress Note
      </button>
      <button class="btn btn-outline btn-sm" id="btn-action-reassign" style="color:var(--color-danger); border-color:var(--color-danger);">
        <i class="fa-solid fa-arrow-right-arrow-left"></i> Request Reassignment
      </button>
    `;
    document.getElementById('btn-action-resolve').addEventListener('click', () => {
      openModal('resolve', 'Mark Complaint as Resolved', 'Detail how the issue was fixed, components replaced, or repairs made...', true);
    });
    document.getElementById('btn-action-note').addEventListener('click', () => {
      openModal('note', 'Add Progress Milestone', 'Enter progress update...');
    });
    document.getElementById('btn-action-reassign').addEventListener('click', () => {
      openModal('reassign', 'Request Reassignment from Admin', 'Explain reason for reassignment...');
    });

  } else if (s === 'Resolved') {
    container.innerHTML = `
      <div style="font-size:0.88rem; color:var(--color-success); font-weight:700; display:flex; align-items:center; gap:0.5rem;">
        <i class="fa-solid fa-circle-check"></i> Ticket resolved on ${formatDate(c.resolvedAt || c.updatedAt)}. Awaiting student review & administrator closure.
      </div>
      <button class="btn btn-outline btn-sm" id="btn-action-note" style="margin-top:0.4rem;">
        <i class="fa-solid fa-comment-dots"></i> Append Additional Note
      </button>
    `;
    document.getElementById('btn-action-note').addEventListener('click', () => {
      openModal('note', 'Append Additional Note', 'Add note to resolved ticket...');
    });

  } else if (s === 'Closed') {
    container.innerHTML = `
      <div style="font-size:0.88rem; color:var(--text-secondary); display:flex; align-items:center; gap:0.5rem;">
        <i class="fa-solid fa-lock"></i> Complaint verified and permanently closed on ${formatDate(c.closedAt || c.updatedAt)}.
      </div>
    `;
  }
}

function renderFeedback(c) {
  const card = document.getElementById('feedback-section');
  const content = document.getElementById('feedback-content');
  if (!card || !content) return;

  if (c.feedback && c.feedback.rating) {
    card.style.display = 'block';
    const rating = Math.round(c.feedback.rating);
    content.innerHTML = `
      <div style="padding:1rem; background:var(--border-light); border-radius:var(--radius-md);">
        <div style="color:#f59e0b; font-size:1.3rem; margin-bottom:0.25rem;">
          ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}
        </div>
        <p style="font-size:0.92rem; color:var(--text-primary); font-style:italic; margin:0 0 0.4rem 0;">"${escapeHtml(c.feedback.comment || 'No comment provided.')}"</p>
        <div style="font-size:0.75rem; color:var(--text-muted);">Submitted by student on ${formatDate(c.feedback.submittedAt)}</div>
      </div>
    `;
  } else {
    card.style.display = 'none';
  }
}

function renderTimeline(timeline) {
  const container = document.getElementById('timeline-container');
  if (!container) return;

  if (!timeline || timeline.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">No timeline updates recorded.</p>';
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
              <i class="fa-solid fa-user-check"></i> ${escapeHtml(ev.performedByName || ev.updatedByName || 'User')} (${escapeHtml(ev.performedByRole || ev.updatedByRole || 'admin')})
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function openModal(actionType, title, placeholder, showEvidence = false) {
  const modal = document.getElementById('faculty-action-modal');
  const titleEl = document.getElementById('modal-ticket-title');
  const typeInput = document.getElementById('action-type-hidden');
  const notes = document.getElementById('action-notes');
  const evidenceGroup = document.getElementById('evidence-group');

  if (titleEl) titleEl.textContent = title;
  if (typeInput) typeInput.value = actionType;
  if (notes) {
    notes.value = '';
    notes.placeholder = placeholder;
  }
  if (evidenceGroup) evidenceGroup.style.display = showEvidence ? 'block' : 'none';

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

  const closeModal = () => {
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const actionType = document.getElementById('action-type-hidden').value;
      const notes = document.getElementById('action-notes').value.trim();
      const fileInput = document.getElementById('resolution-file-input');
      const evidenceFile = (fileInput && fileInput.files.length > 0) ? fileInput.files[0] : null;

      try {
        showLoader('Submitting update...');

        if (actionType === 'note') {
          await updateComplaintProgress(currentComplaintId, currentFacultyProfile, notes);
          showToast('Progress note logged to audit log.', 'success');
        } else if (actionType === 'resolve') {
          await markComplaintResolved(currentComplaintId, currentFacultyProfile, notes, evidenceFile);
          showToast('Complaint successfully marked as Resolved!', 'success');
        } else if (actionType === 'reassign') {
          await requestReassignment(currentComplaintId, currentFacultyProfile, notes);
          showToast('Reassignment request sent to Central Admin.', 'warning');
        }

        const updated = await getAssignedComplaintById(currentComplaintId, currentFacultyProfile.uid);
        if (updated) {
          loadedComplaintData = updated;
          renderDetailUI(updated);
        }

        hideLoader();
        closeModal();
      } catch (err) {
        hideLoader();
        console.error('Modal submit error:', err);
        showToast(err.message || 'Operation failed.', 'error');
      }
    });
  }
}

function initPrintAndPdf() {
  const printBtn = document.getElementById('print-ticket-btn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      if (!loadedComplaintData) return;
      let wrapper = document.getElementById('print-document-wrapper');
      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'print-document-wrapper';
        document.body.appendChild(wrapper);
      }
      wrapper.innerHTML = `
        <div style="font-family:sans-serif; padding:2rem; max-width:800px; margin:0 auto;">
          <h2>CampusCare Resolution Summary</h2>
          <hr/>
          <p><strong>Ticket ID:</strong> ${loadedComplaintData.ticketId}</p>
          <p><strong>Title:</strong> ${loadedComplaintData.title}</p>
          <p><strong>Student:</strong> ${loadedComplaintData.studentName} (${loadedComplaintData.department})</p>
          <p><strong>Location:</strong> ${loadedComplaintData.location}</p>
          <p><strong>Status:</strong> ${loadedComplaintData.status}</p>
          <p><strong>Assigned Faculty:</strong> ${loadedComplaintData.assignedFacultyName || 'Prof. Sarah Jenkins'}</p>
          <p><strong>Description:</strong> ${loadedComplaintData.description}</p>
          <p><strong>Resolution Remarks:</strong> ${loadedComplaintData.facultyRemarks || 'N/A'}</p>
          <p><strong>Printed Date:</strong> ${new Date().toLocaleString()}</p>
        </div>
      `;
      window.print();
    });
  }

  const pdfBtn = document.getElementById('download-pdf-btn');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', () => {
      if (!loadedComplaintData || !window.html2pdf) {
        showToast('PDF generator ready.', 'info');
        return;
      }
      const element = document.createElement('div');
      element.innerHTML = `
        <div style="font-family:sans-serif; padding:1.5rem; color:#111827;">
          <h2 style="color:#4f46e5; border-bottom:2px solid #4f46e5; padding-bottom:0.5rem;">CampusCare — Faculty Resolution Report</h2>
          <table style="width:100%; border-collapse:collapse; margin-top:1rem; font-size:0.9rem;">
            <tr><td style="padding:6px; font-weight:bold; width:30%;">Ticket ID</td><td style="padding:6px;">${loadedComplaintData.ticketId}</td></tr>
            <tr><td style="padding:6px; font-weight:bold;">Status</td><td style="padding:6px;">${loadedComplaintData.status}</td></tr>
            <tr><td style="padding:6px; font-weight:bold;">Student Name</td><td style="padding:6px;">${loadedComplaintData.studentName}</td></tr>
            <tr><td style="padding:6px; font-weight:bold;">Category</td><td style="padding:6px;">${loadedComplaintData.category}</td></tr>
            <tr><td style="padding:6px; font-weight:bold;">Location</td><td style="padding:6px;">${loadedComplaintData.location}</td></tr>
            <tr><td style="padding:6px; font-weight:bold;">Assigned Faculty</td><td style="padding:6px;">${loadedComplaintData.assignedFacultyName || 'Faculty'}</td></tr>
            <tr><td style="padding:6px; font-weight:bold;">Issue Title</td><td style="padding:6px;">${loadedComplaintData.title}</td></tr>
            <tr><td style="padding:6px; font-weight:bold;">Description</td><td style="padding:6px;">${loadedComplaintData.description}</td></tr>
            <tr><td style="padding:6px; font-weight:bold;">Faculty Remarks</td><td style="padding:6px;">${loadedComplaintData.facultyRemarks || 'N/A'}</td></tr>
          </table>
        </div>
      `;
      window.html2pdf().from(element).save(`${loadedComplaintData.ticketId}_Resolution_Report.pdf`);
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
