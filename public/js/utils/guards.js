/* ==========================================================================
   CampusCare - Session & Role Route Protection Guard
   ========================================================================== */

import { auth, onAuthStateChanged } from '../config/firebase-config.js';
import { getUserProfile } from '../services/user.service.js';
import { showToast } from './toast.js';
import { showLoader, hideLoader } from './loader.js';

export function resolveUrl(targetPath) {
  const isPublicContext = window.location.pathname.includes('/public/');
  if (isPublicContext && !targetPath.startsWith('/public/')) {
    return '/public' + (targetPath.startsWith('/') ? targetPath : '/' + targetPath);
  }
  return targetPath;
}

export function getRoleDashboardUrl(role) {
  if (role === 'admin') {
    return '/admin/dashboard.html';
  }
  if (role === 'faculty') {
    return '/faculty/dashboard.html';
  }
  return '/student/dashboard.html';
}

export function redirectByRole(role) {
  window.location.href = resolveUrl(getRoleDashboardUrl(role));
}

export function requireRole(allowedRoles) {
  return requireAuth(allowedRoles);
}

export function requireAuth(expectedRole = null) {
  showLoader('Authenticating session...');
  return new Promise((resolve, reject) => {
    // 1. Check local demo session first if active
    const demoSessionRaw = localStorage.getItem('campuscare_demo_session');
    if (demoSessionRaw) {
      try {
        const demoProfile = JSON.parse(demoSessionRaw);
        hideLoader();

        // Enforce First-Time Password Change
        if (demoProfile.isFirstLogin) {
          window.location.href = resolveUrl('/login.html?action=first-login');
          reject('First-time password change required.');
          return;
        }

        if (expectedRole) {
          const allowed = Array.isArray(expectedRole) ? expectedRole : [expectedRole];
          if (!allowed.includes(demoProfile.role)) {
            showToast(`Access Denied. Requires ${allowed.join(' or ')} role.`, 'error');
            window.location.href = resolveUrl(getRoleDashboardUrl(demoProfile.role));
            reject('Unauthorized Role');
            return;
          }
        }

        resolve({ user: { uid: demoProfile.uid, email: demoProfile.email }, profile: demoProfile });
        return;
      } catch (e) {
        localStorage.removeItem('campuscare_demo_session');
      }
    }

    // 2. Otherwise check Firebase Auth session
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (!user) {
        hideLoader();
        window.location.href = resolveUrl('/login.html');
        reject('Unauthenticated');
        return;
      }

      try {
        const profile = await getUserProfile(user.uid);
        hideLoader();

        if (!profile) {
          showToast('User profile not found. Please log in again.', 'error');
          window.location.href = resolveUrl('/login.html');
          reject('No Profile');
          return;
        }

        // Enforce First-Time Password Change
        if (profile.isFirstLogin) {
          window.location.href = resolveUrl('/login.html?action=first-login');
          reject('First-time password change required.');
          return;
        }

        // Check role permission
        if (expectedRole) {
          const allowed = Array.isArray(expectedRole) ? expectedRole : [expectedRole];
          if (!allowed.includes(profile.role)) {
            showToast(`Access Denied. Requires ${allowed.join(' or ')} role.`, 'error');
            window.location.href = resolveUrl(getRoleDashboardUrl(profile.role));
            reject('Unauthorized Role');
            return;
          }
        }

        resolve({ user, profile });
      } catch (err) {
        hideLoader();
        console.error('Guard auth error:', err);
        window.location.href = resolveUrl('/login.html');
        reject(err);
      }
    });
  });
}

export function redirectIfAuthenticated() {
  const demoSessionRaw = localStorage.getItem('campuscare_demo_session');
  if (demoSessionRaw) {
    try {
      const demoProfile = JSON.parse(demoSessionRaw);
      // If user still needs to change password, do not auto-redirect away from login
      if (demoProfile && demoProfile.role && !demoProfile.isFirstLogin) {
        window.location.href = resolveUrl(getRoleDashboardUrl(demoProfile.role));
        return;
      }
    } catch (e) {
      localStorage.removeItem('campuscare_demo_session');
    }
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const profile = await getUserProfile(user.uid);
        if (profile && !profile.isFirstLogin) {
          window.location.href = resolveUrl(getRoleDashboardUrl(profile.role));
        }
      } catch (e) {
        console.error('Redirect check error:', e);
      }
    }
  });
}
