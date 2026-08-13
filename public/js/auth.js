/* ==========================================================================
   CampusCare - Firebase Authentication & User Data Module
   ========================================================================== 
   Handles Student Registration, Student Login, Logout, Forgot Password,
   and Session Persistence while saving user documents to Cloud Firestore.
   ========================================================================== */

import { 
  auth, 
  db, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  onAuthStateChanged,
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp 
} from './config/firebase.js';

/**
 * 1. Register a new Student account in Firebase Auth & Firestore
 * 
 * @param {Object} studentData - Object containing { name, email, password }
 * @returns {Promise<Object>} Object containing user credential & Firestore profile data
 */
export async function registerStudent({ name, email, password }) {
  // Step A: Create user credentials in Firebase Authentication
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = userCredential.user.uid;

  // Step B: Prepare student profile document payload with requested Firestore schema
  const userProfile = {
    uid: uid,
    name: name,
    email: email,
    role: 'student',
    createdAt: serverTimestamp()
  };

  // Step C: Save document to Firestore collection 'users' under document ID = {uid}
  const userDocRef = doc(db, 'users', uid);
  await setDoc(userDocRef, userProfile);

  return { user: userCredential.user, profile: userProfile };
}

/**
 * 2. Login an existing Student with Email & Password
 * 
 * @param {string} email - Student email address
 * @param {string} password - Account password
 * @returns {Promise<Object>} User session & Firestore profile data
 */
export async function loginStudent(email, password) {
  // Step A: Authenticate user credentials with Firebase Auth
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const uid = userCredential.user.uid;

  // Step B: Retrieve student profile document from Firestore collection 'users/{uid}'
  const userDocRef = doc(db, 'users', uid);
  const docSnap = await getDoc(userDocRef);

  if (!docSnap.exists()) {
    throw new Error('User profile record does not exist in Firestore database.');
  }

  const profile = docSnap.data();

  // Step C: Verify that the account has the student role
  if (profile.role !== 'student') {
    throw new Error('Unauthorized access. This account is not registered as a Student.');
  }

  return { user: userCredential.user, profile: profile };
}

/**
 * 3. Sign Out Current User Session
 * 
 * @returns {Promise<void>}
 */
export async function logoutUser() {
  await signOut(auth);
}

/**
 * 4. Send Forgot Password Reset Email
 * 
 * @param {string} email - Registered student email address
 * @returns {Promise<void>}
 */
export async function sendForgotPasswordEmail(email) {
  await sendPasswordResetEmail(auth, email);
}

/**
 * 5. Session Persistence Listener
 * Listens for automatic auth state changes across page reloads & redirects.
 * 
 * @param {Function} callback - Callback function receiving (user, profile)
 * @returns {Function} Unsubscribe listener function
 */
export function initSessionListener(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        // Fetch Firestore profile data when session is active
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);
        const profile = docSnap.exists() ? docSnap.data() : null;
        callback(user, profile);
      } catch (err) {
        console.error('Error fetching profile in session listener:', err);
        callback(user, null);
      }
    } else {
      // User is signed out
      callback(null, null);
    }
  });
}
