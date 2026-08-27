/* ==========================================================================
   CampusCare - Main Application Setup & Theme Toggle Module
   ========================================================================== */

import { logoutUser } from './services/auth.service.js';
import { getAllFeedbacks, listenToAllComplaints } from './services/complaint.service.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileSidebar();
  initLogoutButtons();
  initHomepageLiveStats();
});

/**
 * Real-Time Dynamic Homepage Stats (Live Feedback & Resolution Rate)
 */
function initHomepageLiveStats() {
  const satEl = document.getElementById('live-stat-satisfaction');
  const satLabelEl = document.getElementById('live-stat-satisfaction-label');
  const slaEl = document.getElementById('live-stat-sla');
  const mockGrid = document.getElementById('live-mock-grid');

  if (!satEl && !slaEl && !mockGrid) return;

  // Listen to complaints in real-time to compute live feedback rating, turnaround, and mock grid
  listenToAllComplaints((complaints) => {
    try {
      const feedbacks = complaints.filter(c => c.feedback && c.feedback.rating);
      if (satEl) {
        if (feedbacks.length > 0) {
          const sum = feedbacks.reduce((acc, curr) => acc + Number(curr.feedback.rating || 0), 0);
          const avg = (sum / feedbacks.length).toFixed(1);
          satEl.textContent = `${avg} / 5`;
          if (satLabelEl) {
            satLabelEl.textContent = `Live Student Satisfaction (${feedbacks.length} review${feedbacks.length === 1 ? '' : 's'})`;
          }
        } else {
          satEl.textContent = `5.0 / 5`;
          if (satLabelEl) {
            satLabelEl.textContent = `Student Satisfaction`;
          }
        }
      }

      // Compute average resolution turnaround time from resolved complaints
      if (slaEl) {
        const resolvedWithTimes = complaints.filter(c => c.createdAt && (c.resolvedAt || (c.status === 'Resolved' && c.updatedAt)));
        if (resolvedWithTimes.length > 0) {
          let totalHours = 0;
          let count = 0;
          resolvedWithTimes.forEach(c => {
            const start = new Date(c.createdAt).getTime();
            const end = new Date(c.resolvedAt || c.updatedAt).getTime();
            if (!isNaN(start) && !isNaN(end) && end >= start) {
              totalHours += (end - start) / (1000 * 60 * 60);
              count++;
            }
          });

          if (count > 0) {
            const avgHours = Math.round(totalHours / count);
            slaEl.textContent = avgHours > 0 ? `< ${avgHours}h` : `< 24h`;
          }
        }
      }

      // Populate live mock dashboard grid with recent complaints
      if (mockGrid && complaints.length > 0) {
        const sorted = [...complaints]
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 2);

        mockGrid.innerHTML = sorted.map(c => {
          let badgeClass = 'inprogress';
          if (c.status === 'Resolved' || c.status === 'Closed') {
            badgeClass = 'resolved';
          }
          
          return `
            <div class="mock-card" style="display:flex; flex-direction:column; justify-content:space-between; height: 100%;">
              <div>
                <div class="mock-card-header">
                  <span class="mock-ticket">${escapeHtml(c.ticketId || 'CC-2026-0000')}</span>
                  <span class="mock-status-pill ${badgeClass}">${escapeHtml(c.status || 'Submitted')}</span>
                </div>
                <div class="mock-card-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px; font-weight:700; color:var(--text-primary); margin-bottom:0.35rem;">${escapeHtml(c.title)}</div>
              </div>
              <div class="mock-card-meta"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(c.location || 'N/A')}</div>
            </div>
          `;
        }).join('');
      }
    } catch (err) {
      console.warn('Could not compute real-time landing stats:', err);
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
 * Initialize Light / Dark Mode Theme Switcher
 */
function initTheme() {
  const savedTheme = localStorage.getItem('campuscare_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  const updateButtons = (theme) => {
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.innerHTML = theme === 'dark' 
        ? '<i class="fa-solid fa-sun" style="color:#f59e0b;"></i>' 
        : '<i class="fa-solid fa-moon"></i>';
      btn.title = `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`;
    });
  };

  updateButtons(savedTheme);

  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('campuscare_theme', newTheme);
      updateButtons(newTheme);
    });
  });
}

/**
 * Mobile Sidebar Drawer Navigation Toggle
 * – injects a backdrop overlay
 * – closes drawer when overlay is tapped
 * – locks body scroll while drawer is open
 */
function initMobileSidebar() {
  const mobileToggle = document.querySelector('.mobile-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (!mobileToggle || !sidebar) return;

  // Inject overlay div if not already present
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }

  const openSidebar = () => {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeSidebar = () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  };

  mobileToggle.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });

  // Close when tapping the overlay backdrop
  overlay.addEventListener('click', closeSidebar);

  // Close when a nav link is clicked (smooth SPA-like feel)
  sidebar.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 992) closeSidebar();
    });
  });
}

/**
 * Attach Sign-Out Event Handlers
 */
function initLogoutButtons() {
  const logoutBtns = document.querySelectorAll('.logout-btn');
  logoutBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      logoutUser();
    });
  });
}
