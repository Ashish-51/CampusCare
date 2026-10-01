/* ==========================================================================
   CampusCare - Profile Management Controller (With Avatar Upload & Password Reset)
   ========================================================================== */

import { requireAuth } from '../utils/guards.js';
import { updateUserProfile } from '../services/user.service.js';
import { getStudentComplaints, getAllComplaints } from '../services/complaint.service.js';
import { uploadAvatarImage, compressImage } from '../services/storage.service.js';
import { updatePassword } from '../config/firebase-config.js';
import { auth } from '../config/firebase-config.js';
import { showToast } from '../utils/toast.js';
import { showLoader, hideLoader } from '../utils/loader.js';

let currentUserProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { user, profile } = await requireAuth();
    currentUserProfile = profile;

    renderProfileData(profile);
    await loadComplaintMetrics(user.uid, profile.role);
    initAvatarUpload(user.uid);
    initEditProfileForm(user.uid);
    initChangePasswordForm();

    if (profile.role === 'student') {
      const { initNotificationDropdown } = await import('../utils/notification-dropdown.js');
      initNotificationDropdown(user.uid);
    }
  } catch (err) {
    console.error('Profile controller init error:', err);
  }
});

/**
 * Render Profile Data on Page
 */
function renderProfileData(profile) {
  const initial = (profile.fullName || profile.name || 'User').charAt(0).toUpperCase();

  const nameDisplay = document.getElementById('profile-name-display');
  const emailDisplay = document.getElementById('profile-email-display');
  const initialDisplay = document.getElementById('avatar-initial');
  const avatarDisplay = document.getElementById('avatar-display');
  const roleBadge = document.getElementById('profile-role-badge');

  const infoDept = document.getElementById('info-dept');
  const infoRoll = document.getElementById('info-roll');
  const infoPhone = document.getElementById('info-phone');

  const editName = document.getElementById('edit-name');
  const editEmail = document.getElementById('edit-email');
  const editDept = document.getElementById('edit-dept');
  const editPhone = document.getElementById('edit-phone');

  if (nameDisplay) nameDisplay.textContent = profile.fullName || profile.name || 'User';
  if (emailDisplay) emailDisplay.textContent = profile.email || 'user@campuscare.edu';

  if (roleBadge) {
    if (profile.role === 'admin') {
      roleBadge.textContent = 'Administrator';
      roleBadge.className = 'badge badge-inprogress';
    } else if (profile.role === 'faculty') {
      roleBadge.textContent = 'Faculty Member';
      roleBadge.className = 'badge badge-assigned';
    } else {
      roleBadge.textContent = 'Student Account';
      roleBadge.className = 'badge badge-submitted';
    }
  }

  if (profile.photoURL && avatarDisplay) {
    avatarDisplay.innerHTML = `<img src="${profile.photoURL}" alt="Profile Avatar" class="profile-avatar-img" id="avatar-img-element" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'profile-avatar-placeholder\\' id=\\'avatar-initial\\'>${initial}</div>';" />`;
  } else if (initialDisplay) {
    initialDisplay.textContent = initial;
  }

  const defaultDept = profile.role === 'admin' ? 'Central Administration' : (profile.role === 'faculty' ? 'Computer Science & Engineering' : 'Computer Science & Engineering');
  const defaultId = profile.facultyId || profile.rollNumber || (profile.role === 'admin' ? 'ADM-101' : (profile.role === 'faculty' ? 'FAC-2026-408' : 'CS2026-042'));

  if (infoDept) infoDept.textContent = profile.department || defaultDept;
  if (infoRoll) infoRoll.textContent = defaultId;
  if (infoPhone) infoPhone.textContent = profile.phone || '+1 555-0192';

  const editRoll = document.getElementById('edit-roll');
  if (editName) editName.value = profile.fullName || profile.name || '';
  if (editEmail) editEmail.value = profile.email || '';
  if (editDept) editDept.value = profile.department || defaultDept;
  if (editRoll) editRoll.value = defaultId;
  if (editPhone) editPhone.value = profile.phone || '';
}

/**
 * Load Total Complaint Count Metric
 */
async function loadComplaintMetrics(uid, role) {
  const countEl = document.getElementById('info-complaint-count');
  if (!countEl) return;

  try {
    if (role === 'admin') {
      const list = await getAllComplaints();
      countEl.textContent = `${list.length} Total Managed`;
    } else if (role === 'faculty') {
      const { getAssignedComplaints } = await import('../services/complaint.service.js');
      const list = await getAssignedComplaints(uid);
      countEl.textContent = `${list.length} Assigned`;
    } else {
      const list = await getStudentComplaints(uid);
      countEl.textContent = `${list.length} Lodged`;
    }
  } catch (e) {
    console.warn('Failed to load complaint metrics count:', e);
    countEl.textContent = '0 Recorded';
  }
}

/**
 * Handle Profile Picture Upload with instant compressed preview & fallback
 */
function initAvatarUpload(uid) {
  const avatarInput = document.getElementById('avatar-input');
  if (!avatarInput) return;

  avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WEBP).', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image size must be less than 10MB.', 'warning');
      return;
    }

    // 1. Instant client-side compression for immediate DOM preview (~50ms)
    const { dataUrl } = await compressImage(file, 300, 300, 0.8);
    const avatarDisplay = document.getElementById('avatar-display');
    if (avatarDisplay && dataUrl) {
      avatarDisplay.innerHTML = `<img src="${dataUrl}" alt="Profile Avatar" class="profile-avatar-img" id="avatar-img-element" />`;
    }

    try {
      showLoader('Updating profile picture...');
      const uploadResult = await uploadAvatarImage(uid, file);
      const downloadUrl = uploadResult ? uploadResult.url : dataUrl;

      if (downloadUrl) {
        await updateUserProfile(uid, { photoURL: downloadUrl });
        
        // Update DOM element with saved URL
        if (avatarDisplay) {
          const initial = (currentUserProfile?.fullName || 'U').charAt(0).toUpperCase();
          avatarDisplay.innerHTML = `<img src="${downloadUrl}" alt="Profile Avatar" class="profile-avatar-img" id="avatar-img-element" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'profile-avatar-placeholder\\' id=\\'avatar-initial\\'>${initial}</div>';" />`;
        }

        hideLoader();
        showToast('Profile picture updated successfully!', 'success');
      } else {
        throw new Error('Upload returned empty URL.');
      }
    } catch (err) {
      hideLoader();
      console.error('Avatar upload error:', err);
      showToast('Failed to save uploaded picture.', 'error');
    }
  });
}

/**
 * Handle Profile Information Save Form
 */
function initEditProfileForm(uid) {
  const form = document.getElementById('edit-profile-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = form.fullName ? form.fullName.value.trim() : '';
    const department = form.department ? form.department.value : '';
    const phone = form.phone ? form.phone.value.trim() : '';

    if (!fullName) {
      showToast('Please provide your full name.', 'warning');
      return;
    }

    const updatePayload = { fullName, department, phone };
    if (form.rollNumber) {
      updatePayload.rollNumber = form.rollNumber.value.trim();
    }

    try {
      showLoader('Updating profile details...');
      await updateUserProfile(uid, updatePayload);
      hideLoader();

      // Update local DOM displays
      const nameDisplay = document.getElementById('profile-name-display');
      const infoDept = document.getElementById('info-dept');
      const infoRoll = document.getElementById('info-roll');
      const infoPhone = document.getElementById('info-phone');

      if (nameDisplay) nameDisplay.textContent = fullName;
      if (infoDept) infoDept.textContent = department;
      if (infoRoll && updatePayload.rollNumber !== undefined) infoRoll.textContent = updatePayload.rollNumber;
      if (infoPhone) infoPhone.textContent = phone;

      showToast('Profile information saved successfully!', 'success');
    } catch (err) {
      hideLoader();
      console.error('Save profile error:', err);
      showToast('Failed to update profile: ' + err.message, 'error');
    }
  });
}

/**
 * Handle Password Update Form
 */
function initChangePasswordForm() {
  const form = document.getElementById('change-password-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPass = form.newPassword ? form.newPassword.value : '';
    const confirmPass = form.confirmPassword ? form.confirmPassword.value : '';

    if (newPass.length < 6) {
      showToast('Password must be at least 6 characters long.', 'warning');
      return;
    }

    if (newPass !== confirmPass) {
      showToast('New Password and Confirm Password do not match.', 'error');
      return;
    }

    try {
      showLoader('Updating password...');
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPass);
      } else {
        // Demo session password simulation
        const demoSessionRaw = localStorage.getItem('campuscare_demo_session');
        if (demoSessionRaw) {
          const demoProfile = JSON.parse(demoSessionRaw);
          demoProfile.password = newPass;
          localStorage.setItem('campuscare_demo_session', JSON.stringify(demoProfile));
        }
      }
      hideLoader();
      showToast('Password changed successfully!', 'success');
      form.reset();
    } catch (err) {
      hideLoader();
      console.error('Change password error:', err);
      showToast(err.message || 'Failed to update password. Re-authentication may be required.', 'error');
    }
  });
}

