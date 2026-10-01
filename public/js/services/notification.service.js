/* ==========================================================================
   CampusCare - Realtime Notification Firestore Service
   ========================================================================== */

import { 
  db, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  serverTimestamp 
} from '../config/firebase-config.js';

const LOCAL_NOTIF_KEY = 'campuscare_notifications';

function getLocalNotifications() {
  const data = localStorage.getItem(LOCAL_NOTIF_KEY);
  return data ? JSON.parse(data) : [];
}

function saveLocalNotifications(list) {
  localStorage.setItem(LOCAL_NOTIF_KEY, JSON.stringify(list));
}

/**
/**
 * Send a notification to any recipient (student, faculty, or admin)
 */
export async function sendNotification(recipientId, ticketId, complaintId, message, type = 'status_update', recipientRole = null) {
  const notifObj = {
    recipientId,
    ticketId,
    complaintId,
    message,
    type,
    recipientRole,
    read: false,
    createdAt: new Date().toISOString()
  };

  try {
    await addDoc(collection(db, 'notifications'), {
      ...notifObj,
      createdAt: serverTimestamp()
    });
    return;
  } catch (err) {
    console.warn('Firestore sendNotification fallback to local:', err.message);
  }

  const localList = getLocalNotifications();
  localList.unshift({ id: 'n-' + Date.now(), ...notifObj });
  saveLocalNotifications(localList);
}

/**
 * Reusable createNotification helper
 */
export async function createNotification(data) {
  return await sendNotification(
    data.recipientId,
    data.ticketId,
    data.complaintId,
    data.message,
    data.type || 'status_update',
    data.recipientRole || null
  );
}

/**
 * Get all notifications for a specific user ID
 */
export async function getUserNotifications(userId) {
  try {
    const q = query(collection(db, 'notifications'), where('recipientId', '==', userId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  } catch (err) {
    console.warn('Firestore getUserNotifications failed, using local list:', err.message);
  }

  const localList = getLocalNotifications();
  return localList.filter(n => n.recipientId === userId);
}

/**
 * Realtime Firestore Snapshot Listener for User Notifications
 */
export function subscribeToUserNotifications(userId, callback) {
  try {
    const q = query(collection(db, 'notifications'), where('recipientId', '==', userId));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      callback(list);
    }, (err) => {
      console.warn('Notification snapshot failed (falling back to local):', err.message);
      const localList = getLocalNotifications().filter(n => n.recipientId === userId);
      callback(localList);
    });
  } catch (e) {
    const localList = getLocalNotifications().filter(n => n.recipientId === userId);
    callback(localList);
  }
}

// Backward-compatible alias
export const subscribeToStudentNotifications = subscribeToUserNotifications;

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(notifId) {
  try {
    const notifRef = doc(db, 'notifications', notifId);
    await updateDoc(notifRef, { read: true });
  } catch (err) {
    console.warn('Mark read failed locally:', err.message);
  }

  const localList = getLocalNotifications();
  const target = localList.find(n => n.id === notifId);
  if (target) {
    target.read = true;
    saveLocalNotifications(localList);
  }
}

/**
 * Mark all notifications for a recipient as read
 */
export async function markAllNotificationsAsRead(userId) {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      where('read', '==', false)
    );
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map(d => updateDoc(doc(db, 'notifications', d.id), { read: true }))
    );
  } catch (err) {
    console.warn('Mark all read failed, updating local fallback:', err.message);
    const localList = getLocalNotifications();
    localList.forEach(n => {
      if (n.recipientId === userId) n.read = true;
    });
    saveLocalNotifications(localList);
  }
}
