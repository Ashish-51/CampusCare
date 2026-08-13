/* ==========================================================================
   CampusCare - Complaint Details & Timeline Controller
   ========================================================================== */

import { requireAuth, resolveUrl } from '../utils/guards.js';
import { getComplaintDetails, submitComplaintFeedback } from '../services/complaint.service.js';
import { formatDate, renderStatusBadge, renderUrgencyBadge } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';
import { showLoader, hideLoader } from '../utils/loader.js';

let currentComplaintId = null;
let currentRating = 5;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { profile } = await requireAuth();
    const urlParams = new URLSearchParams(window.location.search);
    currentComplaintId = urlParams.get('id');

    if (!currentComplaintId) {
      currentComplaintId = sessionStorage.getItem('cc_active_complaint_id');
    } else {
      sessionStorage.setItem('cc_active_complaint_id', currentComplaintId);
    }

    if (!currentComplaintId) {
      showToast('No complaint specified.', 'error');
      window.location.href = resolveUrl(profile.role === 'admin' ? '/admin/dashboard.html' : '/student/dashboard.html');
      return;
    }

    await loadComplaintDetails(profile);

    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await loadComplaintDetails(profile);
        showToast('Firestore details refreshed.', 'info');
      });
    }

    const printBtn = document.getElementById('print-ticket-btn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }

  } catch (err) {
    console.error('View complaint controller error:', err);
  }
});

/**
 * Fetch and Render Complaint Details from Firestore
 */
async function loadComplaintDetails(currentProfile) {
  showLoader('Retrieving complaint details from Firestore...');
  const complaint = await getComplaintDetails(currentComplaintId);
  hideLoader();

  if (!complaint) {
    showToast('Complaint document not found.', 'error');
    return;
  }

  // 1. Complaint ID (Ticket ID)
  const ticketIdEl = document.getElementById('complaint-ticket-id');
  if (ticketIdEl) ticketIdEl.textContent = complaint.ticketId || complaint.id;

  // 2. Status Badge & Priority Badge
  const statusBadgeEl = document.getElementById('complaint-status-badge');
  const priorityBadgeEl = document.getElementById('complaint-priority-badge') || document.getElementById('complaint-urgency-badge');
  if (statusBadgeEl) statusBadgeEl.innerHTML = renderStatusBadge(complaint.status);
  if (priorityBadgeEl) priorityBadgeEl.innerHTML = renderUrgencyBadge(complaint.urgency);

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

  // 6. Created Date & Updated Date
  const createdDateEl = document.getElementById('meta-created-date') || document.getElementById('complaint-date');
  const updatedDateEl = document.getElementById('meta-updated-date');
  if (createdDateEl) createdDateEl.textContent = formatDate(complaint.createdAt);
  if (updatedDateEl) updatedDateEl.textContent = formatDate(complaint.updatedAt || complaint.createdAt);

  // 7. Admin Remarks Box
  const adminRemarksEl = document.getElementById('admin-remarks-box');
  if (adminRemarksEl) {
    if (complaint.adminRemarks && complaint.adminRemarks.trim() !== '') {
      adminRemarksEl.innerHTML = `
        <div style="background:var(--border-light); border:1px solid var(--border-color); padding:1.1rem; border-radius:var(--radius-md);">
          <h4 style="font-size:0.85rem; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.3rem;">
            <i class="fa-solid fa-user-shield"></i> Administration Remarks / Action Notes:
          </h4>
          <p style="font-size:0.92rem; color:var(--text-primary); margin-top:0.25rem;">${escapeHtml(complaint.adminRemarks)}</p>
          ${complaint.assignedTo ? `<div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.4rem;">Assigned Lead: <strong style="color:var(--text-primary);">${escapeHtml(complaint.assignedTo)}</strong></div>` : ''}
        </div>
      `;
    } else {
      adminRemarksEl.innerHTML = '';
    }
  }

  // 8. Attached Image Evidence
  const imgContainer = document.getElementById('complaint-image-container');
  if (imgContainer) {
    if (complaint.imageUrl) {
      imgContainer.innerHTML = `
        <h4 style="font-size:0.85rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.5rem;">
          <i class="fa-solid fa-image"></i> Attachment Evidence Photo:
        </h4>
        <a href="${complaint.imageUrl}" target="_blank" rel="noopener">
          <img src="${complaint.imageUrl}" alt="Evidence Photo" class="evidence-image-preview" title="Click to open full resolution image" />
        </a>
      `;
    } else {
      imgContainer.innerHTML = `
        <div style="font-size:0.82rem; color:var(--text-muted); font-style:italic;">
          <i class="fa-solid fa-image-slash"></i> No image attachment provided.
        </div>
      `;
    }
  }

  // 9. Timeline Sub-collection Events
  renderTimelineEvents(complaint.timeline || []);

  // 10. Post-Resolution Feedback Section
  renderFeedbackSection(complaint, currentProfile);
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
              <span class="timeline-title">${escapeHtml(ev.title)}</span>
              <span class="timeline-date">${formatDate(ev.timestamp)}</span>
            </div>
            ${ev.note ? `<div class="timeline-note">${escapeHtml(ev.note)}</div>` : ''}
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.35rem;">
              <i class="fa-solid fa-user-check"></i> ${escapeHtml(ev.updatedByName || 'System')} (${ev.updatedByRole || 'admin'})
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
function renderFeedbackSection(complaint, currentProfile) {
  const feedbackCard = document.getElementById('feedback-section');
  const feedbackContent = document.getElementById('feedback-content');

  if (!feedbackCard || !feedbackContent) return;

  if (complaint.status === 'Resolved' && currentProfile.role === 'student' && !complaint.feedback) {
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

        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-paper-plane"></i> Submit Feedback & Close Ticket</button>
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
      showLoader('Submitting rating feedback to Firestore...');
      await submitComplaintFeedback(currentComplaintId, currentRating, comment);
      hideLoader();
      showToast('Thank you for rating resolution quality!', 'success');
      window.location.reload();
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
