/* ==========================================================================
   CampusCare - Authentication Service Layer with Predefined Institutional Accounts
   Roles: student | faculty | admin (No public self-registration)
   ========================================================================== */

import { 
  auth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  updatePassword,
  sendPasswordResetEmail
} from '../config/firebase-config.js';
import { createUserProfile, getUserProfile, updateUserProfile } from './user.service.js';
import { resolveUrl } from '../utils/guards.js';

/**
 * Predefined institutional demo accounts for instant evaluation
 */
export const PREDEFINED_USERS = [
  {
    uid: 'demo-student-id',
    email: 'student@campuscare.edu',
    defaultPassword: 'Student@123',
    password: 'Student@123',
    fullName: 'Alex Morgan',
    role: 'student',
    department: 'Computer Science & Engineering',
    rollNumber: 'CS2026-042',
    phone: '+1 555-0192',
    isFirstLogin: true,
    createdAt: new Date().toISOString()
  },
  {
    uid: 'demo-faculty-id',
    email: 'faculty@campuscare.edu',
    defaultPassword: 'Faculty@123',
    password: 'Faculty@123',
    fullName: 'Prof. Sarah Jenkins',
    role: 'faculty',
    department: 'Computer Science & Engineering',
    rollNumber: 'FAC-2026-408',
    facultyId: 'FAC-2026-408',
    phone: '+1 555-0284',
    isFirstLogin: true,
    createdAt: new Date().toISOString()
  },
  {
    uid: 'demo-admin-id',
    email: 'admin@campuscare.edu',
    defaultPassword: 'Admin@123',
    password: 'Admin@123',
    fullName: 'Dr. Robert Vance',
    role: 'admin',
    department: 'Central Administration',
    rollNumber: 'ADM-101',
    phone: '+1 555-0100',
    isFirstLogin: true,
    createdAt: new Date().toISOString()
  }
];

/**
 * Retrieve or initialize the predefined demo users list from localStorage
 */
export function getPredefinedUsers() {
  try {
    const raw = localStorage.getItem('campuscare_demo_users');
    if (raw) {
      const parsed = JSON.parse(raw);
      // Validate that it has the required roles including faculty
      const hasFaculty = parsed.some(u => u.role === 'faculty');
      if (hasFaculty && parsed.length >= 3) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading demo users, resetting to default:', e);
  }

  // Auto-seed default predefined users
  localStorage.setItem('campuscare_demo_users', JSON.stringify(PREDEFINED_USERS));
  return PREDEFINED_USERS;
}

/**
 * Hard Reset: Remove all old user and admin data from database & storage,
 * and restore pristine predefined demo accounts.
 */
export function resetAllDatabaseData() {
  localStorage.removeItem('campuscare_demo_session');
  localStorage.setItem('campuscare_demo_users', JSON.stringify(PREDEFINED_USERS));
  localStorage.removeItem('campuscare_demo_complaints');
  console.log('CampusCare database wiped and re-initialized with predefined users.');
}

/**
 * Complete First-Time Login Password Change
 * Updates the user's permanent personal password and clears firstLogin flag
 */
export async function completeFirstTimePasswordChange(uid, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters long.');
  }

  // 1. If Firebase Auth user is present, update in Firebase Auth
  if (auth.currentUser) {
    try {
      await updatePassword(auth.currentUser, newPassword);
    } catch (e) {
      console.warn('Firebase updatePassword warning:', e.message);
    }
  }

  // 2. Update Firestore profile if connected
  try {
    await updateUserProfile(uid, { isFirstLogin: false });
  } catch (e) {
    console.warn('Firestore profile update warning:', e.message);
  }

  // 3. Update localStorage demo users registry
  try {
    const users = getPredefinedUsers();
    const index = users.findIndex(u => u.uid === uid || u.email.toLowerCase() === (auth.currentUser?.email || '').toLowerCase());
    if (index !== -1) {
      users[index].password = newPassword;
      users[index].isFirstLogin = false;
      users[index].updatedAt = new Date().toISOString();
      localStorage.setItem('campuscare_demo_users', JSON.stringify(users));

      // Also update active session
      const currentSessionRaw = localStorage.getItem('campuscare_demo_session');
      if (currentSessionRaw) {
        const session = JSON.parse(currentSessionRaw);
        session.isFirstLogin = false;
        session.password = newPassword;
        localStorage.setItem('campuscare_demo_session', JSON.stringify(session));
      }
      return users[index];
    }
  } catch (e) {
    console.error('Error updating demo user password:', e);
  }

  return { isFirstLogin: false };
}

/**
 * Authenticate any user (Student, Faculty, or Administrator)
 */
export async function loginUser(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPassword = (password || '');

  try {
    const credential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
    let profile = await getUserProfile(credential.user.uid);
    if (!profile) {
      profile = {
        uid: credential.user.uid,
        email: credential.user.email,
        fullName: cleanEmail.includes('admin') ? 'Administrator' : (cleanEmail.includes('faculty') ? 'Faculty Member' : 'Student'),
        role: cleanEmail.includes('admin') ? 'admin' : (cleanEmail.includes('faculty') ? 'faculty' : 'student'),
        department: 'Computer Science & Engineering',
        isFirstLogin: false
      };
      await createUserProfile(credential.user.uid, profile);
    }
    localStorage.setItem('campuscare_demo_session', JSON.stringify(profile));
    return { user: credential.user, profile };
  } catch (err) {
    if (isDemoOrApiKeyError(err) || (err.code && (err.code.includes('invalid-credential') || err.code.includes('user-not-found')))) {
      console.warn('Firebase Auth fallback to predefined institutional user registry.');
      
      const users = getPredefinedUsers();
      const matchedUser = users.find(u => u.email.toLowerCase() === cleanEmail);

      if (!matchedUser) {
        throw new Error('Account not found. Access is restricted to pre-assigned institutional accounts. Contact administration.');
      }

      // Check password (matches personalized password or default initial password)
      const validPasswords = [matchedUser.password, matchedUser.defaultPassword].filter(Boolean);
      if (!validPasswords.includes(cleanPassword)) {
        throw new Error('Incorrect password. Please verify your credentials or use the assigned default password.');
      }

      // Persist active session
      localStorage.setItem('campuscare_demo_session', JSON.stringify(matchedUser));
      return { 
        user: { uid: matchedUser.uid, email: matchedUser.email }, 
        profile: matchedUser 
      };
    }
    throw err;
  }
}

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
 * Update current user password from profile settings
 */
export async function changeUserPassword(newPassword) {
  if (auth.currentUser) {
    await updatePassword(auth.currentUser, newPassword);
  } else {
    const sessionRaw = localStorage.getItem('campuscare_demo_session');
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw);
      await completeFirstTimePasswordChange(session.uid, newPassword);
    }
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

export const changePassword = changeUserPassword;

export async function loginStudent(email, password) {
  const result = await loginUser(email, password);
  if (result.profile.role !== 'student') {
    throw new Error('Access denied: Account is not a student.');
  }
  return result;
}

export async function loginFaculty(email, password) {
  const result = await loginUser(email, password);
  if (result.profile.role !== 'faculty') {
    throw new Error('Access denied: Account is not faculty.');
  }
  return result;
}

export async function loginAdmin(email, password) {
  const result = await loginUser(email, password);
  if (result.profile.role !== 'admin') {
    throw new Error('Access denied: Account is not an administrator.');
  }
  return result;
}

export const getStudentProfile = getUserProfile;
export const updateStudentProfile = updateUserProfile;
export const getFacultyProfile = getUserProfile;
export const updateFacultyProfile = updateUserProfile;

// Backward compatibility stubs (registration is disabled via UI)
export async function registerStudent(userData) {
  throw new Error('Public registration is disabled. Accounts are pre-assigned by administration.');
}

export async function registerAdmin(adminData) {
  throw new Error('Admin registration is disabled. Administrator accounts are pre-provisioned.');
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
