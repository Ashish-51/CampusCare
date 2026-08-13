/* ==========================================================================
   CampusCare - Student Feedback Controller
   ========================================================================== */

import { requireAuth } from '../utils/guards.js';
import { getStudentFeedbackComplaints, submitComplaintFeedback } from '../services/complaint.service.js';
import { formatDate } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';
import { showLoader, hideLoader } from '../utils/loader.js';

let activeRatings = {};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { user, profile } = await requireAuth();
    await loadFeedbackData(user.uid);
  } catch (err) {
    console.error('Student feedback controller init error:', err);
  }
});

async function loadFeedbackData(uid) {
  showLoader('Loading feedback items...');
  const complaints = await getStudentFeedbackComplaints(uid);
  hideLoader();

  const pendingList = complaints.filter(c => c.status === 'Resolved' && !c.feedback);
  const submittedList = complaints.filter(c => c.feedback && c.feedback.rating);

  // Update counters
  const pendingEl = document.getElementById('count-pending');
  const submittedEl = document.getElementById('count-submitted');
  if (pendingEl) pendingEl.textContent = pendingList.length;
  if (submittedEl) submittedEl.textContent = submittedList.length;

  renderPendingList(pendingList);
  renderHistoryList(submittedList);
}

/**
 * Render Pending Feedback Cards
 */
function renderPendingList(list) {
  const container = document.getElementById('pending-feedback-list');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="card empty-state">
        <div class="empty-icon"><i class="fa-solid fa-circle-check" style="color:var(--status-resolved);"></i></div>
        <h3>No Pending Feedback</h3>
        <p>All resolved complaints have been reviewed. Great job helping us improve campus services!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(c => {
    activeRatings[c.id] = activeRatings[c.id] || 5;
    return `
      <div class="feedback-card" id="card-${c.id}">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.75rem;">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <span class="ticket-id">${escapeHtml(c.ticketId || c.id)}</span>
            <span class="badge badge-resolved"><i class="fa-solid fa-check"></i> Resolved</span>
          </div>
          <span style="font-size:0.82rem; color:var(--text-muted);"><i class="fa-solid fa-calendar-check"></i> Resolved on ${formatDate(c.resolvedAt || c.updatedAt)}</span>
        </div>

        <h3 style="font-size:1.15rem; font-weight:800; margin-bottom:0.5rem; color:var(--text-primary);">${escapeHtml(c.title)}</h3>
        <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:1.25rem;"><strong>Category:</strong> ${escapeHtml(c.category)} | <strong>Location:</strong> ${escapeHtml(c.location)}</p>

        ${c.adminRemarks ? `
          <div style="background:var(--primary-light); border:1px solid var(--primary-border); padding:0.85rem 1rem; border-radius:var(--radius-md); margin-bottom:1.25rem; font-size:0.88rem;">
            <strong style="color:var(--primary);"><i class="fa-solid fa-user-shield"></i> Resolution Notes:</strong> ${escapeHtml(c.adminRemarks)}
          </div>
        ` : ''}

        <form class="pending-feedback-form" data-id="${c.id}">
          <div class="form-group">
            <label class="form-label">Rate Service Resolution Quality (1 to 5 Stars):</label>
            <div class="star-rating-input" data-id="${c.id}">
              <span class="star active" data-val="1">★</span>
              <span class="star active" data-val="2">★</span>
              <span class="star active" data-val="3">★</span>
              <span class="star active" data-val="4">★</span>
              <span class="star active" data-val="5">★</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="review-${c.id}">Write Review / Additional Remarks:</label>
            <textarea id="review-${c.id}" name="comment" class="form-control" placeholder="Describe your experience with the maintenance team's resolution speed, behavior, or quality..." required style="min-height:85px;"></textarea>
          </div>

          <div style="display:flex; justify-content:flex-end;">
            <button type="submit" class="btn btn-primary"><i class="fa-solid fa-paper-plane"></i> Submit Review & Close Ticket</button>
          </div>
        </form>
      </div>
    `;
  }).join('');

  attachPendingEvents();
}

/**
 * Attach Star Rating and Form Submit Listeners
 */
function attachPendingEvents() {
  document.querySelectorAll('.star-rating-input').forEach(wrapper => {
    const compId = wrapper.dataset.id;
    const stars = wrapper.querySelectorAll('.star');

    stars.forEach(star => {
      star.addEventListener('click', () => {
        const val = parseInt(star.dataset.val, 10);
        activeRatings[compId] = val;
        stars.forEach(s => {
          const sVal = parseInt(s.dataset.val, 10);
          if (sVal <= val) {
            s.classList.add('active');
          } else {
            s.classList.remove('active');
          }
        });
      });
    });
  });

  document.querySelectorAll('.pending-feedback-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const compId = form.dataset.id;
      const rating = activeRatings[compId] || 5;
      const comment = form.comment.value.trim();

      if (!comment) {
        showToast('Please write a short review comment.', 'warning');
        return;
      }

      try {
        showLoader('Submitting your feedback to Firestore...');
        await submitComplaintFeedback(compId, rating, comment);
        hideLoader();
        showToast('Feedback submitted successfully!', 'success');

        const { user } = await requireAuth();
        await loadFeedbackData(user.uid);
      } catch (err) {
        hideLoader();
        console.error('Submit feedback error:', err);
        showToast('Failed to submit feedback.', 'error');
      }
    });
  });
}

/**
 * Render Submitted Feedback History Cards
 */
function renderHistoryList(list) {
  const container = document.getElementById('history-feedback-list');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="card empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon"><i class="fa-solid fa-comment-slash"></i></div>
        <h3>No Submitted Feedback Yet</h3>
        <p>Reviews submitted for resolved complaints will be archived here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(c => {
    const f = c.feedback;
    const rating = f.rating || 5;
    const starsHtml = '★'.repeat(rating) + '☆'.repeat(5 - rating);

    return `
      <div class="feedback-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
          <div>
            <span class="ticket-id" style="font-size:0.8rem; padding:0.15rem 0.5rem;">${escapeHtml(c.ticketId || c.id)}</span>
            <h4 style="font-size:1.05rem; font-weight:800; margin-top:0.4rem; color:var(--text-primary);">${escapeHtml(c.title)}</h4>
          </div>
          <div class="rating-badge">
            <i class="fa-solid fa-star"></i> ${rating}.0 / 5
          </div>
        </div>

        <div style="color:#f59e0b; font-size:1.35rem; margin-bottom:0.75rem; letter-spacing:2px;">
          ${starsHtml}
        </div>

        <p style="font-size:0.92rem; color:var(--text-primary); line-height:1.55; font-style:italic; background:var(--border-light); padding:0.85rem 1rem; border-radius:var(--radius-md); margin-bottom:0.85rem;">
          "${escapeHtml(f.comment || 'No review comment provided.')}"
        </p>

        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.78rem; color:var(--text-muted);">
          <span><i class="fa-solid fa-folder"></i> ${escapeHtml(c.category)}</span>
          <span><i class="fa-solid fa-clock"></i> Submitted ${formatDate(f.submittedAt)}</span>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}
