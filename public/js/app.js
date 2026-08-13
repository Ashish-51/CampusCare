/* ==========================================================================
   CampusCare - Main Application Setup & Theme Toggle Module
   ========================================================================== */

import { logoutUser } from './services/auth.service.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileSidebar();
  initLogoutButtons();
});

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
 */
function initMobileSidebar() {
  const mobileToggle = document.querySelector('.mobile-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
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
