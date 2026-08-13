/* ==========================================================================
   CampusCare - Admin Registration Controller
   ========================================================================== */

import { registerAdmin, DEFAULT_ADMIN_SECRET_KEY } from '../services/auth.service.js';
import { resolveUrl } from '../utils/guards.js';
import { showToast } from '../utils/toast.js';
import { showLoader, hideLoader } from '../utils/loader.js';

document.addEventListener('DOMContentLoaded', () => {
  const adminRegisterForm = document.getElementById('admin-register-form');
  if (adminRegisterForm) {
    adminRegisterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = adminRegisterForm.fullName.value.trim();
      const email = adminRegisterForm.email.value.trim();
      const password = adminRegisterForm.password.value;
      const department = adminRegisterForm.department.value;
      const phone = adminRegisterForm.phone.value.trim();
      const adminKey = adminRegisterForm.adminKey.value.trim();

      if (password.length < 6) {
        showToast('Password must be at least 6 characters.', 'warning');
        return;
      }

      if (!adminKey) {
        showToast('Secret Admin Passcode is required.', 'warning');
        return;
      }

      if (adminKey !== DEFAULT_ADMIN_SECRET_KEY) {
        showToast('Invalid Admin Security Key! Access Denied.', 'error');
        return;
      }

      try {
        showLoader('Registering Admin Account...');
        await registerAdmin({ fullName, email, password, department, phone, adminKey });
        hideLoader();
        showToast('Admin Account Created! Welcome to CampusCare Admin Panel.', 'success');
        window.location.href = resolveUrl('/admin/dashboard.html');
      } catch (err) {
        hideLoader();
        console.error('Admin Registration Error:', err);
        showToast(err.message || 'Admin registration failed.', 'error');
      }
    });
  }
});
