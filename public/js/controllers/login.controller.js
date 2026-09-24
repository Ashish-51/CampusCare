import { registerStudent, registerAdmin, loginUser, sendResetPassword, logoutUser } from '../services/auth.service.js';
import { resolveUrl } from '../utils/guards.js';
import { showToast } from '../utils/toast.js';
import { showLoader, hideLoader } from '../utils/loader.js';
import { auth, onAuthStateChanged } from '../config/firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
  // Clear any existing session to prevent auto-login on public terminals
  localStorage.removeItem('campuscare_demo_session');
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    unsubscribe();
    if (user) {
      logoutUser();
    }
  });
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

  // Unified Registration Form
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    const roleRadios = registerForm.querySelectorAll('input[name="accountRole"]');
    const studentFields = document.getElementById('student-fields');
    const adminFields = document.getElementById('admin-fields');
    const emailLabel = document.getElementById('label-reg-email');

    roleRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.value === 'admin') {
          studentFields.style.display = 'none';
          adminFields.style.display = 'block';
          emailLabel.textContent = 'Institutional Admin Email *';
        } else {
          studentFields.style.display = 'block';
          adminFields.style.display = 'none';
          emailLabel.textContent = 'Institutional Email *';
        }
      });
    });

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const role = registerForm.accountRole.value;
      const fullName = registerForm.fullName.value.trim();
      const email = registerForm.email.value.trim();
      const password = registerForm.password.value;

      if (password.length < 6) {
        showToast('Password must be at least 6 characters.', 'warning');
        return;
      }

      try {
        if (role === 'admin') {
          const department = registerForm.departmentAdmin.value;
          const phone = registerForm.phoneAdmin.value.trim();
          const adminKey = registerForm.adminKey.value.trim();

          if (!adminKey) {
            showToast('Admin Security Passcode is required.', 'warning');
            return;
          }

          showLoader('Creating admin account...');
          await registerAdmin({ fullName, email, password, department, phone, adminKey });
          hideLoader();
          showToast('Admin registration successful!', 'success');
          window.location.href = resolveUrl('/admin/dashboard.html');
        } else {
          const department = registerForm.departmentStudent.value;
          const rollNumber = registerForm.rollNumber.value.trim();
          const phone = registerForm.phoneStudent.value.trim();

          showLoader('Creating your account...');
          await registerStudent({ fullName, email, password, department, rollNumber, phone });
          hideLoader();
          showToast('Registration successful! Welcome to CampusCare.', 'success');
          window.location.href = resolveUrl('/student/dashboard.html');
        }
      } catch (err) {
        hideLoader();
        console.error('Registration error:', err);
        showToast(err.message || 'Registration failed. Check your details or email may already be in use.', 'error');
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
