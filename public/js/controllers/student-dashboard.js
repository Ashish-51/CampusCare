/* ==========================================================================
   CampusCare - Student Dashboard Controller
   ========================================================================== */

import { requireAuth, resolveUrl } from '../utils/guards.js';
import { getStudentComplaints, listenToStudentComplaints } from '../services/complaint.service.js';
import { formatDate, formatTimeAgo, renderStatusBadge, renderUrgencyBadge } from '../utils/formatters.js';
import { initNotificationDropdown } from '../utils/notification-dropdown.js';

let allComplaints = [];

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { user, profile } = await requireAuth('student');
    renderProfileSummary(profile);
    initNotificationDropdown(user.uid);
    
    // Subscribe to Firestore Real-Time Updates
    listenToStudentComplaints(user.uid, (updatedList) => {
      allComplaints = updatedList;
      renderMetrics(allComplaints);
      renderComplaintsTable(allComplaints);
      renderNotificationsFeed(allComplaints);
    });

    initFilterListeners();
  } catch (err) {
    console.error('Student dashboard init error:', err);
  }
});

/**
 * Populate Profile Summary Widget
 */
function renderProfileSummary(profile) {
  const initial = (profile.fullName || 'Student').charAt(0).toUpperCase();

  const userDisplayNameEl = document.getElementById('user-display-name');
  const userDisplayDeptEl = document.getElementById('user-display-dept');
  const avatarBadgeEl = document.getElementById('user-avatar-badge');
  const cardAvatarSmEl = document.getElementById('card-avatar-sm');
  const welcomeNameEl = document.getElementById('welcome-student-name');
  const cardProfileNameEl = document.getElementById('card-profile-name');
  const cardProfileEmailEl = document.getElementById('card-profile-email');
  const cardProfileDeptEl = document.getElementById('card-profile-dept');
  const cardProfileRollEl = document.getElementById('card-profile-roll');

  if (userDisplayNameEl) userDisplayNameEl.textContent = profile.fullName || 'Student';
  if (userDisplayDeptEl) userDisplayDeptEl.textContent = profile.department || 'Student Account';

  if (profile.photoURL) {
    const avatarHtml = `<img src="${profile.photoURL}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.onerror=null; this.parentElement.textContent='${initial}';" />`;
    if (avatarBadgeEl) avatarBadgeEl.innerHTML = avatarHtml;
    if (cardAvatarSmEl) cardAvatarSmEl.innerHTML = avatarHtml;
  } else {
    if (avatarBadgeEl) avatarBadgeEl.textContent = initial;
    if (cardAvatarSmEl) cardAvatarSmEl.textContent = initial;
  }

  if (welcomeNameEl) welcomeNameEl.textContent = profile.fullName || 'Student';
  if (cardProfileNameEl) cardProfileNameEl.textContent = profile.fullName || 'Student Name';
  if (cardProfileEmailEl) cardProfileEmailEl.textContent = profile.email || 'student@campus.edu';
  if (cardProfileDeptEl) cardProfileDeptEl.textContent = profile.department || 'General Science';
  if (cardProfileRollEl) cardProfileRollEl.textContent = profile.rollNumber || 'CS2026-042';
}

/**
 * Load and render complaints data
 */
async function loadComplaints(studentId) {
  allComplaints = await getStudentComplaints(studentId);
  renderMetrics(allComplaints);
  renderComplaintsTable(allComplaints);
}

/**
 * Render Metric Cards (Total, Pending, In Progress, Resolved)
 */
function renderMetrics(complaints) {
  const totalEl = document.getElementById('stat-total');
  const pendingEl = document.getElementById('stat-pending');
  const inProgressEl = document.getElementById('stat-inprogress');
  const resolvedEl = document.getElementById('stat-resolved');

  if (totalEl) totalEl.textContent = complaints.length;
  if (pendingEl) {
    pendingEl.textContent = complaints.filter(c => c.status === 'Submitted').length;
  }
  if (inProgressEl) {
    inProgressEl.textContent = complaints.filter(c => c.status === 'In Progress').length;
  }
  if (resolvedEl) {
    resolvedEl.textContent = complaints.filter(c => c.status === 'Resolved' || c.status === 'Closed').length;
  }
}

/**
 * Render Recent Complaints Data Table
 */
function renderComplaintsTable(list) {
  const tbody = document.getElementById('student-complaints-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:3rem 1.5rem;">
          <div style="font-size:2.5rem; color:var(--text-muted); margin-bottom:0.75rem;"><i class="fa-solid fa-folder-open"></i></div>
          <h4 style="font-size:1.1rem; font-weight:700; margin-bottom:0.3rem;">No complaints found</h4>
          <p style="color:var(--text-muted); font-size:0.88rem; margin-bottom:1rem;">You haven't lodged any complaints matching your current filter criteria.</p>
          <a href="${resolveUrl('/student/raise-complaint.html')}" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Lodge a Complaint</a>
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
      <td><span class="badge" style="background:var(--border-light); color:var(--text-primary);">${escapeHtml(c.category)}</span></td>
      <td>${renderUrgencyBadge(c.urgency)}</td>
      <td>${renderStatusBadge(c.status)}</td>
      <td>
        <a href="${resolveUrl('/student/view-complaint.html?id=' + c.id)}" data-id="${c.id}" class="btn btn-outline btn-sm track-link">
          Track <i class="fa-solid fa-arrow-right"></i>
        </a>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.track-link').forEach(link => {
    link.addEventListener('click', () => {
      if (link.dataset.id) {
        sessionStorage.setItem('cc_active_complaint_id', link.dataset.id);
      }
    });
  });
}

/**
 * Render Notifications Feed
 */
function renderNotificationsFeed(complaints) {
  const feedEl = document.getElementById('notifications-feed');
  const countEl = document.getElementById('notif-count');
  if (!feedEl) return;

  const notifs = [];

  complaints.forEach(c => {
    if (c.status === 'In Progress') {
      notifs.push({
        icon: 'fa-spinner',
        text: `Ticket <strong>${c.ticketId}</strong> was moved to <strong>In Progress</strong>.`,
        time: formatTimeAgo(c.updatedAt || c.createdAt)
      });
    } else if (c.status === 'Resolved') {
      notifs.push({
        icon: 'fa-circle-check',
        text: `Ticket <strong>${c.ticketId}</strong> has been marked <strong>Resolved</strong>. Rate your feedback!`,
        time: formatTimeAgo(c.resolvedAt || c.updatedAt)
      });
    }
  });

  // System welcome message
  notifs.push({
    icon: 'fa-bell',
    text: 'Welcome to CampusCare portal. Your session is active.',
    time: 'System'
  });

  if (countEl) countEl.textContent = `${notifs.length} New`;

  feedEl.innerHTML = notifs.slice(0, 4).map(n => `
    <div class="notification-item">
      <div class="notification-icon"><i class="fa-solid ${n.icon}"></i></div>
      <div style="font-size:0.85rem; line-height:1.4;">
        <div>${n.text}</div>
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.15rem;">${n.time}</div>
      </div>
    </div>
  `).join('');
}

/**
 * Filter and Search Handlers for Student Dashboard
 */
function initFilterListeners() {
  const statusFilter = document.getElementById('status-filter');
  const categoryFilter = document.getElementById('category-filter');
  const searchInput = document.getElementById('search-input');

  const applyFilters = () => {
    const statusVal = statusFilter ? statusFilter.value : 'ALL';
    const catVal = categoryFilter ? categoryFilter.value : 'ALL';
    const queryVal = searchInput ? searchInput.value.trim().toLowerCase() : '';

    let filtered = allComplaints;

    if (catVal && catVal !== 'ALL') {
      filtered = filtered.filter(c => c.category === catVal);
    }

    if (statusVal && statusVal !== 'ALL') {
      filtered = filtered.filter(c => c.status === statusVal);
    }

    if (queryVal) {
      filtered = filtered.filter(c => 
        (c.ticketId && c.ticketId.toLowerCase().includes(queryVal)) ||
        (c.title && c.title.toLowerCase().includes(queryVal)) ||
        (c.description && c.description.toLowerCase().includes(queryVal)) ||
        (c.location && c.location.toLowerCase().includes(queryVal)) ||
        (c.category && c.category.toLowerCase().includes(queryVal)) ||
        (c.urgency && c.urgency.toLowerCase().includes(queryVal)) ||
        (c.status && c.status.toLowerCase().includes(queryVal))
      );
    }

    renderComplaintsTable(filtered);
  };

  if (statusFilter) statusFilter.addEventListener('change', applyFilters);
  if (categoryFilter) categoryFilter.addEventListener('change', applyFilters);
  if (searchInput) searchInput.addEventListener('input', applyFilters);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}
