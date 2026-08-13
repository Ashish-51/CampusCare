import { registerStudent, loginUser, sendResetPassword } from '../services/auth.service.js';
import { redirectIfAuthenticated, resolveUrl } from '../utils/guards.js';
import { showToast } from '../utils/toast.js';
import { showLoader, hideLoader } from '../utils/loader.js';

document.addEventListener('DOMContentLoaded', () => {
  redirectIfAuthenticated();
  initTabs();
  initForms();
  initForgotPasswordModal();
});

function initTabs() {
  const tabBtns = document.querySelectorAll('.auth-tab-btn');
  const forms = document.querySelectorAll('.auth-form');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      forms.forEach(f => f.style.display = 'none');

      btn.classList.add('active');
      const targetForm = document.getElementById(btn.dataset.target);
      if (targetForm) targetForm.style.display = 'block';
    });
  });
}

function initForms() {
  // Student Login Form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;

      try {
        showLoader('Signing in...');
        const { profile } = await loginUser(email, password);
        hideLoader();
        showToast('Login successful!', 'success');

        if (profile && profile.role === 'admin') {
          window.location.href = resolveUrl('/admin/dashboard.html');
        } else {
          window.location.href = resolveUrl('/student/dashboard.html');
        }
      } catch (err) {
        hideLoader();
        console.error('Login error:', err);
        showToast(err.message || 'Login failed. Please check your credentials.', 'error');
      }
    });
  }

  // Student Registration Form
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = registerForm.fullName.value.trim();
      const email = registerForm.email.value.trim();
      const password = registerForm.password.value;
      const department = registerForm.department.value;
      const rollNumber = registerForm.rollNumber.value.trim();
      const phone = registerForm.phone.value.trim();

      if (password.length < 6) {
        showToast('Password must be at least 6 characters.', 'warning');
        return;
      }

      try {
        showLoader('Creating your account...');
        await registerStudent({ fullName, email, password, department, rollNumber, phone });
        hideLoader();
        showToast('Registration successful! Welcome to CampusCare.', 'success');
        window.location.href = resolveUrl('/student/dashboard.html');
      } catch (err) {
        hideLoader();
        console.error('Registration error:', err);
        showToast(err.message || 'Registration failed. Email may already be in use.', 'error');
      }
    });
  }
}

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
      const email = resetEmailInput ? resetEmailInput.value.trim() : '';

      if (!email || !email.includes('@')) {
        showToast('Please enter a valid institutional email address.', 'warning');
        return;
      }

      try {
        showLoader(`Dispatching password reset link to ${email}...`);
        await sendResetPassword(email);
        hideLoader();
        closeModal();
        showToast(`📧 Password reset email sent to ${email}! Check your inbox.`, 'success', 5500);
      } catch (err) {
        hideLoader();
        console.error('Password reset error:', err);
        showToast(err.message || 'Failed to send password reset email.', 'error');
      }
    });
  }
}
