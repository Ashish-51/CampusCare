/* ==========================================================================
   CampusCare - User Service Layer
   ========================================================================== */

import { db, doc, getDoc, setDoc, updateDoc, serverTimestamp } from '../config/firebase-config.js';

export async function createUserProfile(uid, profileData) {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    ...profileData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function getUserProfile(uid) {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    return snap.data();
  }
  return null;
}

export async function updateUserProfile(uid, updateData) {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('Firestore user profile update failed:', err.message);
    const demoSessionRaw = localStorage.getItem('campuscare_demo_session');
    if (!demoSessionRaw) {
      throw err; // Rethrow to show the error on the UI
    }
  }

  // Update demo session in local storage if active
  const demoSessionRaw = localStorage.getItem('campuscare_demo_session');
  if (demoSessionRaw) {
    try {
      const demoProfile = JSON.parse(demoSessionRaw);
      const updatedDemoProfile = { ...demoProfile, ...updateData };
      localStorage.setItem('campuscare_demo_session', JSON.stringify(updatedDemoProfile));

      // Also update the persistent user list in localStorage
      const existingUsersRaw = localStorage.getItem('campuscare_demo_users');
      if (existingUsersRaw) {
        const demoUsers = JSON.parse(existingUsersRaw);
        const userIndex = demoUsers.findIndex(u => u.uid === demoProfile.uid || u.email.toLowerCase() === demoProfile.email.toLowerCase());
        if (userIndex !== -1) {
          demoUsers[userIndex] = { ...demoUsers[userIndex], ...updateData };
          localStorage.setItem('campuscare_demo_users', JSON.stringify(demoUsers));
        }
      }
    } catch (e) {
      console.error('Error updating local demo session profile:', e);
    }
  }
}

