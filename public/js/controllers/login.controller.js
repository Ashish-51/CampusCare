/* ==========================================================================
   CampusCare - Institutional Login Controller
   Handles Predefined Logins & Enforces First-Time Password Change
   ========================================================================== */

import { 
  loginUser, 
  logoutUser, 
  sendResetPassword, 
  completeFirstTimePasswordChange, 
  resetAllDatabaseData,
  PREDEFINED_USERS 
} from '../services/auth.service.js';
import { resolveUrl, getRoleDashboardUrl } from '../utils/guards.js';
import { showToast } from '../utils/toast.js';
import { showLoader, hideLoader } from '../utils/loader.js';
import { auth, onAuthStateChanged } from '../config/firebase-config.js';

let pendingFirstTimeProfile = null;

document.addEventListener('DOMContentLoaded', () => {
  // Clear any existing active session on login screen entry
  localStorage.removeItem('campuscare_demo_session');
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    unsubscribe();
    if (user) {
      logoutUser();
    }
  });

  initLoginForm();
  initDemoPills();
  initFirstTimePasswordModal();
  initForgotPasswordModal();
  initResetDbButton();
});

/**
 * Handle Primary Institutional Sign In
 */
function initLoginForm() {
  const loginForm = document.getElementById('login-form');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;

    try {
      showLoader('Authenticating institutional credentials...');
      const { user, profile } = await loginUser(email, password);
      hideLoader();

      // Check if user is logging in for the first time
      if (profile && profile.isFirstLogin) {
        showToast('First-time login detected. Please set your personal password.', 'info');
        openFirstTimeModal(profile, password);
        return;
      }

      showToast(`Welcome back, ${profile.fullName || 'User'}!`, 'success');
      window.location.href = resolveUrl(getRoleDashboardUrl(profile.role));
    } catch (err) {
      hideLoader();
      console.error('Login error:', err);
      showToast(err.message || 'Login failed. Please verify your credentials.', 'error');
    }
  });
}

/**
 * Open First-Time Password Change Modal
 */
function openFirstTimeModal(profile, enteredPassword) {
  pendingFirstTimeProfile = profile;
  const modal = document.getElementById('first-time-modal');
  const nameEl = document.getElementById('first-time-user-name');
  const roleEl = document.getElementById('first-time-role-badge');
  const currentEl = document.getElementById('first-time-current');
  const newPassEl = document.getElementById('first-time-new');
  const confirmPassEl = document.getElementById('first-time-confirm');

  if (nameEl) nameEl.textContent = profile.fullName || 'User';
  if (roleEl) {
    roleEl.textContent = profile.role;
    roleEl.className = `badge ${profile.role === 'admin' ? 'badge-in-progress' : (profile.role === 'faculty' ? 'badge-submitted' : 'badge-resolved')}`;
  }
  if (currentEl) currentEl.value = enteredPassword || profile.defaultPassword || '';
  if (newPassEl) newPassEl.value = '';
  if (confirmPassEl) confirmPassEl.value = '';

  if (modal) {
    modal.style.display = 'flex';
    setTimeout(() => {
      modal.classList.add('active');
      if (newPassEl) newPassEl.focus();
    }, 10);
  }
}

/**
 * Handle First-Time Password Change Form Submission
 */
function initFirstTimePasswordModal() {
  const form = document.getElementById('first-time-password-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pendingFirstTimeProfile) {
      showToast('Session expired. Please log in again.', 'error');
      window.location.reload();
      return;
    }

    const newPassword = form.newPassword.value;
    const confirmPassword = form.confirmPassword.value;

    if (newPassword.length < 6) {
      showToast('Personal password must be at least 6 characters.', 'warning');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match. Please re-enter.', 'warning');
      return;
    }

    try {
      showLoader('Setting your personal password...');
      await completeFirstTimePasswordChange(pendingFirstTimeProfile.uid, newPassword);
      hideLoader();

      showToast('Personal password set successfully! Welcome to CampusCare.', 'success');
      
      const modal = document.getElementById('first-time-modal');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }

      // Route directly to user's assigned dashboard
      const dest = getRoleDashboardUrl(pendingFirstTimeProfile.role);
      window.location.href = resolveUrl(dest);
    } catch (err) {
      hideLoader();
      console.error('Password change error:', err);
      showToast(err.message || 'Failed to update password. Please try again.', 'error');
    }
  });
}

/**
 * Predefined Demo Accounts Quick-Select Pills
 */
function initDemoPills() {
  const pills = document.querySelectorAll('.demo-pill');
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const email = pill.dataset.email;
      const pass = pill.dataset.pass;

      if (emailInput && email) emailInput.value = email;
      if (passInput && pass) passInput.value = pass;

      showToast(`Selected demo credentials for ${email.split('@')[0].toUpperCase()}`, 'info');
    });
  });
}

/**
 * Reset Demo Database button
 */
function initResetDbButton() {
  const resetBtn = document.getElementById('reset-db-btn');
  if (!resetBtn) return;

  resetBtn.addEventListener('click', () => {
    if (confirm('Wipe old user & ticket data and restore pristine default demo accounts?')) {
      resetAllDatabaseData();
      showToast('Database wiped and re-initialized with predefined accounts!', 'success');
      
      const emailInput = document.getElementById('login-email');
      const passInput = document.getElementById('login-password');
      if (emailInput) emailInput.value = '';
      if (passInput) passInput.value = '';
    }
  });
}

/**
 * Forgot Password Modal Handler
 */
function initForgotPasswordModal() {
  const forgotBtn = document.getElementById('forgot-password-btn');
  const modal = document.getElementById('forgot-password-modal');
  const closeBtn = document.getElementById('close-reset-modal');
  const cancelBtn = document.getElementById('cancel-reset-btn');
  const resetForm = document.getElementById('reset-password-form');
  const resetEmailInput = document.getElementById('reset-email');
  const loginEmailInput = document.getElementById('login-email');

  const openModal = () => {
    if (modal) {
      if (loginEmailInput && loginEmailInput.value.trim() && resetEmailInput) {
        resetEmailInput.value = loginEmailInput.value.trim();
      }
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('active'), 10);
    }
  };

  const closeModal = () => {
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => { modal.style.display = 'none'; }, 200);
    }
  };

  if (forgotBtn) forgotBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = resetForm.resetEmail.value.trim();

      try {
        showLoader('Sending password reset email...');
        const result = await sendResetPassword(email);
        hideLoader();
        closeModal();

        if (result.mode === 'demo_fallback') {
          showToast(`[Demo Mode] Password reset link sent to ${email}`, 'success');
        } else {
          showToast(`Password reset link successfully sent to ${email}`, 'success');
        }
      } catch (err) {
        hideLoader();
        console.error('Password reset error:', err);
        showToast(err.message || 'Failed to dispatch reset link.', 'error');
      }
    });
  }
}
