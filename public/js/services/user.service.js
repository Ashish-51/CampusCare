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

/**
 * Fetch all registered Faculty members (for Admin assignment and management)
 */
export async function getAllFaculty() {
  try {
    const { collection, query, where, getDocs } = await import('../config/firebase-config.js');
    const q = query(collection(db, 'users'), where('role', '==', 'faculty'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn('Firestore getAllFaculty error (using fallback):', err.message);
  }

  // Fallback to local demo users
  try {
    const raw = localStorage.getItem('campuscare_demo_users');
    if (raw) {
      const list = JSON.parse(raw);
      return list.filter(u => u.role === 'faculty');
    }
  } catch (e) {
    console.error('Fallback read error:', e);
  }

  return [
    {
      uid: 'demo-faculty-id',
      fullName: 'Prof. Sarah Jenkins',
      email: 'faculty@campuscare.edu',
      role: 'faculty',
      facultyId: 'FAC-2026-408',
      department: 'Computer Science & Engineering',
      phone: '+1 555-0284',
      active: true
    }
  ];
}

/**
 * Fetch all Students (for Admin reference)
 */
export async function getAllStudents() {
  try {
    const { collection, query, where, getDocs } = await import('../config/firebase-config.js');
    const q = query(collection(db, 'users'), where('role', '==', 'student'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn('Firestore getAllStudents error (using fallback):', err.message);
  }

  try {
    const raw = localStorage.getItem('campuscare_demo_users');
    if (raw) {
      const list = JSON.parse(raw);
      return list.filter(u => u.role === 'student');
    }
  } catch (e) {
    console.error('Fallback read error:', e);
  }

  return [];
}

/**
 * Fetch single student details by UID
 */
export async function getStudentDetails(uid) {
  return await getUserProfile(uid);
}

/**
 * Admin: Create a new faculty member profile
 */
export async function createFaculty(facultyData) {
  const uid = facultyData.uid || 'fac-' + Date.now();
  const payload = {
    uid,
    fullName: facultyData.fullName,
    name: facultyData.fullName,
    email: facultyData.email,
    role: 'faculty',
    facultyId: facultyData.facultyId || `FAC-${Math.floor(100 + Math.random() * 900)}`,
    department: facultyData.department || 'General Academic',
    phone: facultyData.phone || '',
    active: true,
    isFirstLogin: true,
    defaultPassword: facultyData.password || 'Faculty@123',
    password: facultyData.password || 'Faculty@123',
    createdAt: new Date().toISOString()
  };

  try {
    await createUserProfile(uid, payload);
  } catch (err) {
    console.warn('Firestore createFaculty warning (updating demo registry):', err.message);
  }

  // Update demo users list
  try {
    const raw = localStorage.getItem('campuscare_demo_users') || '[]';
    const users = JSON.parse(raw);
    users.push(payload);
    localStorage.setItem('campuscare_demo_users', JSON.stringify(users));
  } catch (e) {
    console.error('Error saving new faculty locally:', e);
  }

  return payload;
}

/**
 * Admin: Update faculty information
 */
export async function updateFaculty(uid, data) {
  return await updateUserProfile(uid, data);
}

/**
 * Admin: Disable or enable a faculty account
 */
export async function disableFaculty(uid, active = false) {
  return await updateUserProfile(uid, { active });
}


