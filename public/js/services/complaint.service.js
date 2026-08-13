/* ==========================================================================
   CampusCare - Complaint Firestore Service Layer (With Demo Local Storage Fallback)
   ========================================================================== */

import { 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp
} from '../config/firebase-config.js';
import { generateTicketId } from '../utils/formatters.js';
import { uploadComplaintImage } from './storage.service.js';
import { sendNotification } from './notification.service.js';

// Initial Mock Seed Complaints for instant Demo Testing
const INITIAL_DEMO_COMPLAINTS = [
  {
    id: 'comp-101',
    ticketId: 'CC-2026-1001',
    studentId: 'demo-student-id',
    studentName: 'Alex Morgan',
    studentEmail: 'student@campuscare.edu',
    department: 'Computer Science & Engineering',
    category: 'IT/Wifi',
    title: 'Wi-Fi connection drops repeatedly in Hostel Block B 3rd Floor',
    description: 'The Wi-Fi router on the 3rd floor corridor experiences frequent disconnections every 15-20 minutes, interrupting online lectures and assignment submissions.',
    location: 'Hostel Block B, 3rd Floor Corridor',
    urgency: 'High',
    status: 'In Progress',
    imageUrl: null,
    imagePath: null,
    assignedTo: 'IT Network Team 1',
    adminRemarks: 'Inspected router AP-304. Replacement access point scheduled for deployment.',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    resolvedAt: null,
    feedback: null,
    timeline: [
      {
        id: 't-1',
        status: 'Submitted',
        title: 'Complaint Submitted',
        note: 'Complaint lodged successfully and assigned ticket ID CC-2026-1001.',
        updatedByName: 'Alex Morgan',
        updatedByRole: 'student',
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString()
      },
      {
        id: 't-2',
        status: 'In Progress',
        title: 'Status updated to In Progress',
        note: 'Inspected router AP-304. Replacement access point scheduled for deployment.',
        updatedByName: 'IT Admin',
        updatedByRole: 'admin',
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString()
      }
    ]
  },
  {
    id: 'comp-102',
    ticketId: 'CC-2026-1002',
    studentId: 'demo-student-id',
    studentName: 'Alex Morgan',
    studentEmail: 'student@campuscare.edu',
    department: 'Computer Science & Engineering',
    category: 'Electrical',
    title: 'Ceiling fan making loud squeaking noise & vibrating',
    description: 'The ceiling fan in Room 204 has a loose mounting bracket and makes loud metallic noises when set above speed 2.',
    location: 'Hostel Block B, Room 204',
    urgency: 'Medium',
    status: 'Resolved',
    imageUrl: null,
    imagePath: null,
    assignedTo: 'Electrical Staff Lead',
    adminRemarks: 'Tightened fan rod bolts and lubricated motor bearings. Fully tested.',
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    resolvedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    feedback: {
      rating: 5,
      comment: 'Maintenance team arrived promptly and fixed the fan noise. Great service!',
      submittedAt: new Date(Date.now() - 86400000 * 1 + 1800000).toISOString()
    },
    timeline: [
      {
        id: 't-10',
        status: 'Submitted',
        title: 'Complaint Submitted',
        note: 'Complaint lodged successfully.',
        updatedByName: 'Alex Morgan',
        updatedByRole: 'student',
        timestamp: new Date(Date.now() - 86400000 * 4).toISOString()
      },
      {
        id: 't-11',
        status: 'Resolved',
        title: 'Status updated to Resolved',
        note: 'Tightened fan rod bolts and lubricated motor bearings.',
        updatedByName: 'Electrician Lead',
        updatedByRole: 'admin',
        timestamp: new Date(Date.now() - 86400000 * 1).toISOString()
      }
    ]
  }
];

function getDemoComplaints() {
  const raw = localStorage.getItem('campuscare_complaints');
  if (!raw) {
    localStorage.setItem('campuscare_complaints', JSON.stringify(INITIAL_DEMO_COMPLAINTS));
    return INITIAL_DEMO_COMPLAINTS;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_DEMO_COMPLAINTS;
  }
}

function saveDemoComplaints(list) {
  localStorage.setItem('campuscare_complaints', JSON.stringify(list));
}

/**
 * Create a new student complaint document + timeline event
 */
export async function createComplaint(studentProfile, complaintData, imageFile = null) {
  const complaintId = 'comp-' + Date.now();
  const ticketId = generateTicketId();

  let imageUrl = null;
  let imagePath = null;

  if (imageFile) {
    const uploadRes = await uploadComplaintImage(complaintId, imageFile);
    if (uploadRes) {
      imageUrl = uploadRes.url;
      imagePath = uploadRes.path;
    }
  }

  const payload = {
    id: complaintId,
    ticketId,
    studentId: studentProfile.uid,
    studentName: studentProfile.fullName || 'Student',
    studentEmail: studentProfile.email,
    department: studentProfile.department || 'General',
    category: complaintData.category,
    title: complaintData.title,
    description: complaintData.description,
    location: complaintData.location || 'N/A',
    urgency: complaintData.urgency || 'Medium',
    status: 'Submitted',
    imageUrl,
    imagePath,
    assignedTo: 'Unassigned',
    adminRemarks: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
    feedback: null,
    timeline: [
      {
        id: 't-' + Date.now(),
        status: 'Submitted',
        title: 'Complaint Submitted',
        note: 'Your complaint has been lodged and assigned ticket ID ' + ticketId + '.',
        updatedBy: studentProfile.uid,
        updatedByName: studentProfile.fullName || 'Student',
        updatedByRole: 'student',
        timestamp: new Date().toISOString()
      }
    ]
  };

  try {
    // Attempt Firestore write first
    const complaintRef = doc(db, 'complaints', complaintId);
    await setDoc(complaintRef, payload);
    await addDoc(collection(db, `complaints/${complaintId}/timeline`), payload.timeline[0]);
  } catch (err) {
    console.warn('Firestore write failed (using local demo database):', err.message);
  }

  // Always update local demo state for smooth offline/demo experience
  const localList = getDemoComplaints();
  localList.unshift(payload);
  saveDemoComplaints(localList);

  return payload;
}

/**
 * Fetch complaints raised by student
 */
export async function getStudentComplaints(studentId) {
  try {
    const q = query(collection(db, 'complaints'), where('studentId', '==', studentId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  } catch (err) {
    console.warn('Firestore fetch failed, returning demo list:', err.message);
  }

  const localList = getDemoComplaints();
  return localList.filter(c => c.studentId === studentId || studentId.startsWith('demo-student'));
}

/**
 * Search & Filter student complaints using Firestore queries
 * 
 * @param {string} studentId - Current logged-in student UID
 * @param {Object} filters - { searchQuery, category, status }
 * @returns {Promise<Array>} Filtered complaints list
 */
export async function searchStudentComplaints(studentId, { searchQuery = '', category = 'ALL', status = 'ALL' } = {}) {
  let list = [];

  try {
    const constraints = [where('studentId', '==', studentId)];
    if (category && category !== 'ALL') {
      constraints.push(where('category', '==', category));
    }
    if (status && status !== 'ALL') {
      constraints.push(where('status', '==', status));
    }

    const q = query(collection(db, 'complaints'), ...constraints);
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      list = await getStudentComplaints(studentId);
    }
  } catch (err) {
    console.warn('Firestore parameterized query failed (falling back to memory filter):', err.message);
    list = await getStudentComplaints(studentId);
  }

  // Apply Category filter (if fallback)
  if (category && category !== 'ALL') {
    list = list.filter(c => c.category === category);
  }

  // Apply Status filter (if fallback)
  if (status && status !== 'ALL') {
    list = list.filter(c => c.status === status);
  }

  // Search by Complaint ID (ticketId) or Title
  if (searchQuery && searchQuery.trim() !== '') {
    const queryTerm = searchQuery.toLowerCase().trim();
    list = list.filter(c => 
      (c.ticketId && c.ticketId.toLowerCase().includes(queryTerm)) ||
      (c.title && c.title.toLowerCase().includes(queryTerm)) ||
      (c.category && c.category.toLowerCase().includes(queryTerm)) ||
      (c.status && c.status.toLowerCase().includes(queryTerm))
    );
  }

  return list;
}

/**
 * Fetch all complaints (for Admin view)
 */
export async function getAllComplaints(filters = {}) {
  let list = [];

  try {
    const snap = await getDocs(collection(db, 'complaints'));
    if (!snap.empty) {
      list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  } catch (err) {
    console.warn('Firestore fetch failed, using local demo database:', err.message);
  }

  if (list.length === 0) {
    list = getDemoComplaints();
  }

  // Apply filters
  if (filters.status && filters.status !== 'ALL') {
    list = list.filter(item => item.status === filters.status);
  }
  if (filters.category && filters.category !== 'ALL') {
    list = list.filter(item => item.category === filters.category);
  }
  if (filters.urgency && filters.urgency !== 'ALL') {
    list = list.filter(item => item.urgency === filters.urgency);
  }
  if (filters.searchQuery) {
    const qLower = filters.searchQuery.toLowerCase();
    list = list.filter(item => 
      (item.ticketId && item.ticketId.toLowerCase().includes(qLower)) ||
      (item.title && item.title.toLowerCase().includes(qLower)) ||
      (item.studentName && item.studentName.toLowerCase().includes(qLower)) ||
      (item.department && item.department.toLowerCase().includes(qLower))
    );
  }

  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Fetch single complaint details & timeline
 */
export async function getComplaintDetails(complaintId) {
  try {
    const snap = await getDoc(doc(db, 'complaints', complaintId));
    if (snap.exists()) {
      const data = snap.data();
      const timelineSnap = await getDocs(collection(db, `complaints/${complaintId}/timeline`));
      const timeline = timelineSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      return { id: snap.id, ...data, timeline };
    }
  } catch (err) {
    console.warn('Firestore getDoc failed, reading from demo database:', err.message);
  }

  const localList = getDemoComplaints();
  const found = localList.find(c => c.id === complaintId);
  return found || null;
}

/**
 * Admin: Update complaint status & push timeline event to Firestore
 */
export async function updateComplaintStatus(complaintId, adminUser, status, remarks, assignedTo = null) {
  const newTimelineEventLocal = {
    id: 't-' + Date.now(),
    status,
    title: `Status updated to ${status}`,
    note: remarks || `Complaint status updated to ${status} by Admin (${adminUser.fullName || 'Admin'}).`,
    updatedBy: adminUser.uid,
    updatedByName: adminUser.fullName || 'Administrator',
    updatedByRole: 'admin',
    timestamp: new Date().toISOString()
  };

  const newTimelineEventFirestore = {
    ...newTimelineEventLocal,
    timestamp: serverTimestamp()
  };

  try {
    const complaintRef = doc(db, 'complaints', complaintId);
    const snap = await getDoc(complaintRef);
    const studentId = snap.exists() ? snap.data().studentId : null;
    const ticketId = snap.exists() ? snap.data().ticketId : complaintId;

    const updateData = { 
      status, 
      adminRemarks: remarks || '', 
      updatedAt: serverTimestamp() 
    };
    if (assignedTo) updateData.assignedTo = assignedTo;
    if (status === 'Resolved') updateData.resolvedAt = serverTimestamp();

    await updateDoc(complaintRef, updateData);
    await addDoc(collection(db, `complaints/${complaintId}/timeline`), newTimelineEventFirestore);

    if (studentId) {
      await sendNotification(
        studentId, 
        ticketId, 
        complaintId, 
        `Your complaint ticket ${ticketId} was updated to ${status}.`,
        'status_update'
      );
    }
  } catch (err) {
    console.warn('Firestore status update failed (updating local demo database):', err.message);
  }

  // Update local demo storage
  const localList = getDemoComplaints();
  const target = localList.find(c => c.id === complaintId);
  if (target) {
    target.status = status;
    target.adminRemarks = remarks || '';
    if (assignedTo) target.assignedTo = assignedTo;
    if (status === 'Resolved') target.resolvedAt = new Date().toISOString();
    target.updatedAt = new Date().toISOString();
    target.timeline = target.timeline || [];
    target.timeline.push(newTimelineEventLocal);
    saveDemoComplaints(localList);

    if (target.studentId) {
      sendNotification(
        target.studentId,
        target.ticketId,
        target.id,
        `Your complaint ticket ${target.ticketId} was updated to ${status}.`,
        'status_update'
      );
    }
  }
}

/**
 * Admin: Delete a complaint document
 */
export async function deleteComplaint(complaintId) {
  try {
    const complaintRef = doc(db, 'complaints', complaintId);
    await deleteDoc(complaintRef);
  } catch (err) {
    console.warn('Firestore delete doc failed (removing from local demo database):', err.message);
  }

  // Update local demo storage
  const localList = getDemoComplaints();
  const updatedList = localList.filter(c => c.id !== complaintId);
  saveDemoComplaints(updatedList);
}

export async function submitComplaintFeedback(complaintId, rating, comment) {
  const feedbackData = {
    rating: Number(rating),
    comment: comment || '',
    submittedAt: new Date().toISOString()
  };

  const newTimelineEvent = {
    id: 't-' + Date.now(),
    status: 'Closed',
    title: 'Feedback Submitted & Ticket Closed',
    note: `Student rated resolution ${rating}/5 stars. "${comment || 'No comment provided.'}"`,
    updatedBy: 'student',
    updatedByName: 'Student',
    updatedByRole: 'student',
    timestamp: new Date().toISOString()
  };

  try {
    const complaintRef = doc(db, 'complaints', complaintId);
    await updateDoc(complaintRef, { feedback: feedbackData, status: 'Closed', updatedAt: new Date().toISOString() });
    await addDoc(collection(db, `complaints/${complaintId}/timeline`), newTimelineEvent);
  } catch (err) {
    console.warn('Firestore feedback update failed (updating local demo database):', err.message);
  }

  // Update local demo storage
  const localList = getDemoComplaints();
  const target = localList.find(c => c.id === complaintId);
  if (target) {
    target.feedback = feedbackData;
    target.status = 'Closed';
    target.updatedAt = new Date().toISOString();
    target.timeline = target.timeline || [];
    target.timeline.push(newTimelineEvent);
    saveDemoComplaints(localList);
  }
}

/**
 * Fetch student complaints eligible for feedback or already having feedback
 */
export async function getStudentFeedbackComplaints(studentId) {
  const complaints = await getStudentComplaints(studentId);
  return complaints.filter(c => c.status === 'Resolved' || c.status === 'Closed' || c.feedback != null);
}

/**
 * Fetch all feedback reviews and aggregate statistics for Admin view
 */
export async function getAllFeedbacks() {
  const complaints = await getAllComplaints();
  const feedbacks = complaints.filter(c => c.feedback && c.feedback.rating);

  const total = feedbacks.length;
  let totalRating = 0;
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  feedbacks.forEach(f => {
    const r = Math.min(5, Math.max(1, Math.round(f.feedback.rating)));
    distribution[r] = (distribution[r] || 0) + 1;
    totalRating += r;
  });

  const avgRating = total > 0 ? (totalRating / total).toFixed(1) : '0.0';
  const satisfactionRate = total > 0 ? Math.round(((distribution[5] + distribution[4]) / total) * 100) : 0;

  return {
    feedbacks: feedbacks.sort((a, b) => new Date(b.feedback.submittedAt) - new Date(a.feedback.submittedAt)),
    stats: {
      total,
      avgRating,
      distribution,
      satisfactionRate
    }
  };
}

