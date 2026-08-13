/* ==========================================================================
   CampusCare - Top Navbar Realtime Notification Dropdown Component
   ========================================================================== */

import { subscribeToStudentNotifications, markAllNotificationsAsRead, markNotificationAsRead } from '../services/notification.service.js';
import { formatTimeAgo } from './formatters.js';
import { resolveUrl } from './guards.js';

export function initNotificationDropdown(studentId) {
  const navbarActions = document.querySelector('.navbar-actions');
  if (!navbarActions || !studentId) return;

  // Render Bell Icon Wrapper & Dropdown container if not already present
  let wrapper = document.getElementById('notif-bell-wrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.id = 'notif-bell-wrapper';
    wrapper.className = 'notif-bell-wrapper';
    wrapper.innerHTML = `
      <button class="notif-bell-btn" id="notif-bell-btn" title="Notifications">
        <i class="fa-solid fa-bell"></i>
        <span class="notif-unread-badge" id="notif-badge" style="display:none;">0</span>
      </button>

      <div class="notif-dropdown" id="notif-dropdown">
        <div class="notif-dropdown-header">
          <h4>Notifications</h4>
          <button class="notif-mark-all" id="notif-mark-all-btn">Mark all read</button>
        </div>
        <div class="notif-list" id="notif-dropdown-list">
          <div style="padding:1.5rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">
            No notifications yet.
          </div>
        </div>
      </div>
    `;

    // Insert bell icon before theme-toggle-btn
    const themeBtn = navbarActions.querySelector('.theme-toggle-btn');
    if (themeBtn) {
      navbarActions.insertBefore(wrapper, themeBtn);
    } else {
      navbarActions.appendChild(wrapper);
    }
  }

  const bellBtn = document.getElementById('notif-bell-btn');
  const dropdown = document.getElementById('notif-dropdown');
  const badge = document.getElementById('notif-badge');
  const listContainer = document.getElementById('notif-dropdown-list');
  const markAllBtn = document.getElementById('notif-mark-all-btn');

  // Toggle Dropdown
  if (bellBtn && dropdown) {
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    });
  }

  // Mark all read listener
  if (markAllBtn) {
    markAllBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await markAllNotificationsAsRead(studentId);
    });
  }

  // Subscribe to Realtime Firestore Notifications
  subscribeToStudentNotifications(studentId, (notifications) => {
    const unreadCount = notifications.filter(n => !n.read).length;

    // Update unread badge count
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }

    // Render Notifications Dropdown List
    if (listContainer) {
      if (notifications.length === 0) {
        listContainer.innerHTML = `
          <div style="padding:1.75rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">
            <i class="fa-solid fa-bell-slash" style="font-size:1.5rem; margin-bottom:0.4rem; display:block;"></i>
            No notifications recorded yet.
          </div>
        `;
        return;
      }

      listContainer.innerHTML = notifications.slice(0, 8).map(n => {
        // Escape message to prevent XSS from Firestore data
        const safeMsg = n.message
          ? n.message.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))
          : 'Notification';
        return `
        <div class="notif-dropdown-item ${!n.read ? 'unread' : ''}" data-id="${n.id}" data-complaint="${n.complaintId || ''}">
          <div class="notif-item-icon">
            <i class="fa-solid ${n.type === 'status_update' ? 'fa-pen-to-square' : 'fa-bell'}"></i>
          </div>
          <div class="notif-item-content">
            <div style="font-weight:${!n.read ? '700' : '500'};">${safeMsg}</div>
            <div class="notif-item-time">${formatTimeAgo(n.createdAt)}</div>
          </div>
        </div>
      `;
      }).join('');

      // Add click handlers on individual notification items
      listContainer.querySelectorAll('.notif-dropdown-item').forEach(item => {
        item.addEventListener('click', async () => {
          const id = item.dataset.id;
          const complaintId = item.dataset.complaint;
          await markNotificationAsRead(id);
          if (complaintId) {
            window.location.href = resolveUrl(`/student/view-complaint.html?id=${complaintId}`);
          }
        });
      });
    }
  });
}
