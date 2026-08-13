/* ==========================================================================
   CampusCare - Admin Student Ratings & Feedback Controller
   ========================================================================== */

import { requireAuth, resolveUrl } from '../utils/guards.js';
import { getAllFeedbacks } from '../services/complaint.service.js';
import { formatDate } from '../utils/formatters.js';
import { showLoader, hideLoader } from '../utils/loader.js';

let allReviewsList = [];

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { profile } = await requireAuth();
    await loadAdminFeedbackData();
    initFilters();
  } catch (err) {
    console.error('Admin feedback controller init error:', err);
  }
});

async function loadAdminFeedbackData() {
  showLoader('Loading student ratings & reviews...');
  const { feedbacks, stats } = await getAllFeedbacks();
  hideLoader();

  allReviewsList = feedbacks;

  renderSummaryStats(stats);
  renderDistributionBars(stats);
  renderReviewsFeed(allReviewsList);
}

/**
 * Render Average Rating Score & High Level Stats
 */
function renderSummaryStats(stats) {
  const avgScoreEl = document.getElementById('stat-avg-score');
  const avgStarsEl = document.getElementById('stat-avg-stars');
  const totalCountEl = document.getElementById('stat-total-count');
  const satisfactionPctEl = document.getElementById('stat-satisfaction-pct');

  const avgNum = parseFloat(stats.avgRating || 0);
  const roundedRating = Math.round(avgNum);
  const starsHtml = '★'.repeat(roundedRating) + '☆'.repeat(5 - roundedRating);

  if (avgScoreEl) avgScoreEl.textContent = stats.avgRating || '0.0';
  if (avgStarsEl) avgStarsEl.textContent = starsHtml;
  if (totalCountEl) totalCountEl.textContent = `${stats.total} Total Ratings`;
  if (satisfactionPctEl) satisfactionPctEl.textContent = `${stats.satisfactionRate}% Satisfaction Rate`;
}

/**
 * Render Distribution Bars (5 Star -> 1 Star)
 */
function renderDistributionBars(stats) {
  const container = document.getElementById('distribution-bars');
  if (!container) return;

  const total = stats.total || 1;
  const dist = stats.distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  const starsKeys = [5, 4, 3, 2, 1];

  container.innerHTML = starsKeys.map(starVal => {
    const count = dist[starVal] || 0;
    const pct = Math.round((count / total) * 100);

    return `
      <div class="dist-row">
        <div class="dist-label"><span>${starVal}</span> <i class="fa-solid fa-star" style="color:#f59e0b; font-size:0.8rem;"></i></div>
        <div class="dist-bar-wrapper">
          <div class="dist-bar-fill" style="width: ${stats.total === 0 ? 0 : pct}%;"></div>
        </div>
        <div class="dist-count">${count} (${stats.total === 0 ? 0 : pct}%)</div>
      </div>
    `;
  }).join('');
}

/**
 * Render Filtered Student Reviews Feed
 */
function renderReviewsFeed(list) {
  const container = document.getElementById('admin-reviews-feed');
  const countLabel = document.getElementById('showing-count-label');
  if (!container) return;

  if (countLabel) countLabel.textContent = `Showing ${list.length} review${list.length === 1 ? '' : 's'}`;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="card empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon"><i class="fa-solid fa-comment-slash"></i></div>
        <h3>No Ratings Found</h3>
        <p>No student feedback matching the selected filter criteria.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(item => {
    const f = item.feedback;
    const rating = f.rating || 5;
    const starsHtml = '★'.repeat(rating) + '☆'.repeat(5 - rating);

    return `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
          <div>
            <a href="${resolveUrl('/admin/detail.html?id=' + item.id)}" class="ticket-id" style="font-size:0.8rem; text-decoration:none;" title="Click to view complaint detail">
              ${escapeHtml(item.ticketId || item.id)} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.7rem;"></i>
            </a>
            <h4 style="font-size:1.05rem; font-weight:800; margin-top:0.4rem; color:var(--text-primary);">${escapeHtml(item.title)}</h4>
          </div>
          <span class="badge badge-submitted" style="font-size:0.8rem; font-weight:800;">
            <i class="fa-solid fa-star" style="color:#f59e0b;"></i> ${rating}.0 / 5
          </span>
        </div>

        <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.75rem;">
          <strong>Student:</strong> ${escapeHtml(item.studentName || 'Student')} (${escapeHtml(item.department || 'Dept')})
        </div>

        <div style="color:#f59e0b; font-size:1.25rem; margin-bottom:0.75rem; letter-spacing:2px;">
          ${starsHtml}
        </div>

        <p style="font-size:0.92rem; color:var(--text-primary); line-height:1.55; font-style:italic; background:var(--border-light); padding:0.85rem 1rem; border-radius:var(--radius-md); margin-bottom:0.85rem;">
          "${escapeHtml(f.comment || 'No review comment provided.')}"
        </p>

        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.78rem; color:var(--text-muted);">
          <span><i class="fa-solid fa-tag"></i> ${escapeHtml(item.category)}</span>
          <span><i class="fa-solid fa-clock"></i> Submitted ${formatDate(f.submittedAt)}</span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Filter & Search Event Listeners
 */
function initFilters() {
  const searchInput = document.getElementById('search-reviews');
  const ratingFilter = document.getElementById('filter-star-rating');
  const categoryFilter = document.getElementById('filter-category');

  const applyFilters = () => {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const ratingVal = ratingFilter ? ratingFilter.value : 'ALL';
    const categoryVal = categoryFilter ? categoryFilter.value : 'ALL';

    const filtered = allReviewsList.filter(item => {
      const f = item.feedback;
      if (!f) return false;

      // Rating filter
      if (ratingVal !== 'ALL' && Math.round(f.rating) !== parseInt(ratingVal, 10)) {
        return false;
      }

      // Category filter
      if (categoryVal !== 'ALL' && item.category !== categoryVal) {
        return false;
      }

      // Search query
      if (query) {
        const titleMatch = (item.title || '').toLowerCase().includes(query);
        const ticketMatch = (item.ticketId || '').toLowerCase().includes(query);
        const studentMatch = (item.studentName || '').toLowerCase().includes(query);
        const commentMatch = (f.comment || '').toLowerCase().includes(query);
        if (!titleMatch && !ticketMatch && !studentMatch && !commentMatch) {
          return false;
        }
      }

      return true;
    });

    renderReviewsFeed(filtered);
  };

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (ratingFilter) ratingFilter.addEventListener('change', applyFilters);
  if (categoryFilter) categoryFilter.addEventListener('change', applyFilters);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}
