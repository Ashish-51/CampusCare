/* ==========================================================================
   CampusCare - Authentication Service Layer with Demo Mode Fallback
   ========================================================================== */

import { 
  auth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  updatePassword,
  sendPasswordResetEmail
} from '../config/firebase-config.js';
import { createUserProfile, getUserProfile } from './user.service.js';

/**
 * Register a new student account
 */
export async function registerStudent(userData) {
  const { email, password, fullName, department, rollNumber, phone } = userData;

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;

    const profileData = {
      uid,
      email,
      fullName,
      role: 'student',
      department: department || 'Computer Science & Engineering',
      rollNumber: rollNumber || 'CS2026-001',
      phone: phone || '+1 555-0192',
      createdAt: new Date().toISOString()
    };

    await createUserProfile(uid, profileData);
    return { user: credential.user, profile: profileData };
  } catch (err) {
    if (isDemoOrApiKeyError(err)) {
      console.warn('Firebase API Key invalid or demo mode active. Using local session storage.');
      const demoProfile = {
        uid: 'demo-student-' + Date.now(),
        email,
        fullName,
        role: 'student',
        department: department || 'Computer Science & Engineering',
        rollNumber: rollNumber || 'CS2026-001',
        phone: phone || '+1 555-0192',
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('campuscare_demo_session', JSON.stringify(demoProfile));
      return { user: { uid: demoProfile.uid, email: demoProfile.email }, profile: demoProfile };
    }
    throw err;
  }
}

export const DEFAULT_ADMIN_SECRET_KEY = 'CAMPUS_26';

/**
 * Register a new Admin account (Requires Secret Security Key)
 */
export async function registerAdmin(adminData) {
  const { email, password, fullName, department, phone, adminKey } = adminData;

  if (adminKey !== DEFAULT_ADMIN_SECRET_KEY) {
    throw new Error('Invalid Admin Security Passcode! Access denied.');
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;

    const profileData = {
      uid,
      email,
      fullName,
      role: 'admin',
      department: department || 'Central Administration',
      rollNumber: 'ADM-' + Math.floor(100 + Math.random() * 900),
      phone: phone || '+91 9876543210',
      createdAt: new Date().toISOString()
    };

    await createUserProfile(uid, profileData);
    return { user: credential.user, profile: profileData };
  } catch (err) {
    if (isDemoOrApiKeyError(err)) {
      console.warn('Firebase API Key invalid or demo mode active. Using local admin session storage.');
      const demoProfile = {
        uid: 'demo-admin-' + Date.now(),
        email,
        fullName,
        role: 'admin',
        department: department || 'Central Administration',
        rollNumber: 'ADM-' + Math.floor(100 + Math.random() * 900),
        phone: phone || '+91 9876543210',
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('campuscare_demo_session', JSON.stringify(demoProfile));
      return { user: { uid: demoProfile.uid, email: demoProfile.email }, profile: demoProfile };
    }
    throw err;
  }
}

/**
 * Login user (Student or Admin)
 */
export async function loginUser(email, password) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    let profile = await getUserProfile(credential.user.uid);
    if (!profile) {
      // Default to 'student' role — never guess role from email string
      // Admin role must be assigned manually in the Firestore console
      profile = {
        uid: credential.user.uid,
        email: credential.user.email,
        fullName: 'Student',
        role: 'student',
        department: 'Computer Science & Engineering'
      };
      await createUserProfile(credential.user.uid, profile);
    }
    localStorage.setItem('campuscare_demo_session', JSON.stringify(profile));
    return { user: credential.user, profile };
  } catch (err) {
    if (isDemoOrApiKeyError(err)) {
      console.warn('Firebase Auth API Key invalid or demo environment detected. Granting demo login.');
      const isAdmin = email.toLowerCase().includes('admin');
      const demoProfile = {
        uid: isAdmin ? 'demo-admin-id' : 'demo-student-id',
        email: email,
        fullName: isAdmin ? 'System Administrator' : 'Demo Student',
        role: isAdmin ? 'admin' : 'student',
        department: isAdmin ? 'Central Administration' : 'Computer Science & Engineering',
        rollNumber: isAdmin ? '' : 'CS2026-042',
        phone: '+1 555-0199'
      };
      localStorage.setItem('campuscare_demo_session', JSON.stringify(demoProfile));
      return { user: { uid: demoProfile.uid, email: demoProfile.email }, profile: demoProfile };
    }
    throw err;
  }
}

import { resolveUrl } from '../utils/guards.js';

/**
 * Sign out current user session
 */
export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (e) {
    // Ignore signout errors in demo mode
  }
  localStorage.removeItem('campuscare_demo_session');
  window.location.href = resolveUrl('/login.html');
}

/**
 * Update current user password
 */
export async function changeUserPassword(newPassword) {
  if (auth.currentUser) {
    await updatePassword(auth.currentUser, newPassword);
  } else {
    // Demo mode simulation
    console.log('Password updated in demo session mode.');
  }
}

/**
 * Dispatch Password Reset Link Email to User
 */
export async function sendResetPassword(email) {
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid institutional email address.');
  }

  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true, mode: 'firebase', email };
  } catch (err) {
    if (isDemoOrApiKeyError(err) || (err.code && (err.code.includes('invalid-api-key') || err.code.includes('user-not-found')))) {
      console.warn('Firebase Auth API Key or demo fallback triggered for password reset email:', err.message);
      return { success: true, mode: 'demo_fallback', email };
    }
    throw err;
  }
}

function isDemoOrApiKeyError(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = (err.code || '').toLowerCase();
  return (
    code.includes('api-key-not-valid') || 
    msg.includes('api-key-not-valid') ||
    code.includes('invalid-api-key') ||
    msg.includes('invalid api key')
  );
}
