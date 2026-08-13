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
 * Send a notification to a recipient student or admin
 */
export async function sendNotification(recipientId, ticketId, complaintId, message, type = 'status_update') {
  const notifObj = {
    recipientId,
    ticketId,
    complaintId,
    message,
    type,
    read: false,
    createdAt: new Date().toISOString()
  };

  try {
    await addDoc(collection(db, 'notifications'), {
      ...notifObj,
      createdAt: serverTimestamp()
    });
    // Firestore succeeded — no local fallback needed
    return;
  } catch (err) {
    console.warn('Firestore sendNotification fallback to local:', err.message);
  }

  // Only reach here if Firestore failed — write to local demo storage
  const localList = getLocalNotifications();
  localList.unshift({ id: 'n-' + Date.now(), ...notifObj });
  saveLocalNotifications(localList);
}

/**
 * Realtime Firestore Snapshot Listener for Student Notifications
 */
export function subscribeToStudentNotifications(studentId, callback) {
  try {
    const q = query(collection(db, 'notifications'), where('recipientId', '==', studentId));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      callback(list);
    }, (err) => {
      console.warn('Notification snapshot failed (falling back to local):', err.message);
      const localList = getLocalNotifications().filter(n => n.recipientId === studentId);
      callback(localList);
    });
  } catch (e) {
    const localList = getLocalNotifications().filter(n => n.recipientId === studentId);
    callback(localList);
  }
}

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
export async function markAllNotificationsAsRead(studentId) {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', studentId),
      where('read', '==', false)
    );
    const snap = await getDocs(q);
    // Use Promise.all + map so all awaits are properly tracked
    await Promise.all(
      snap.docs.map(d => updateDoc(doc(db, 'notifications', d.id), { read: true }))
    );
  } catch (err) {
    console.warn('Mark all read failed, updating local fallback:', err.message);
    // Fallback: mark local demo notifications as read
    const localList = getLocalNotifications();
    localList.forEach(n => {
      if (n.recipientId === studentId) n.read = true;
    });
    saveLocalNotifications(localList);
  }
}
