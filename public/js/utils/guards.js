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

export function requireAuth(expectedRole = null) {
  showLoader('Authenticating session...');
  return new Promise((resolve, reject) => {
    // 1. Check local demo session first if active
    const demoSessionRaw = localStorage.getItem('campuscare_demo_session');
    if (demoSessionRaw) {
      try {
        const demoProfile = JSON.parse(demoSessionRaw);
        hideLoader();

        if (expectedRole && demoProfile.role !== expectedRole) {
          showToast(`Access Denied. Requires ${expectedRole} role.`, 'error');
          window.location.href = resolveUrl(demoProfile.role === 'admin' ? '/admin/dashboard.html' : '/student/dashboard.html');
          reject('Unauthorized Role');
          return;
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

        // Check role permission
        if (expectedRole && profile.role !== expectedRole) {
          showToast(`Access Denied. Requires ${expectedRole} role.`, 'error');
          window.location.href = resolveUrl(profile.role === 'admin' ? '/admin/dashboard.html' : '/student/dashboard.html');
          reject('Unauthorized Role');
          return;
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
      if (demoProfile && demoProfile.role) {
        window.location.href = resolveUrl(demoProfile.role === 'admin' ? '/admin/dashboard.html' : '/student/dashboard.html');
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
        if (profile) {
          window.location.href = resolveUrl(profile.role === 'admin' ? '/admin/dashboard.html' : '/student/dashboard.html');
        }
      } catch (e) {
        console.error('Redirect check error:', e);
      }
    }
  });
}
