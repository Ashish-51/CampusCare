/* ==========================================================================
   CampusCare - Complaint Firestore Service Layer (Student ↔ Admin ↔ Faculty)
   Supports 3 Roles: student | faculty | admin
   ========================================================================== */

import { 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  addDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  onSnapshot,
  serverTimestamp
} from '../config/firebase-config.js';
import { generateTicketId } from '../utils/formatters.js';
import { uploadComplaintImage } from './storage.service.js';
import { sendNotification } from './notification.service.js';

export const DEFAULT_CATEGORIES = [
  'Hostel',
  'Academics',
  'Infrastructure',
  'Mess/Catering',
  'Electrical',
  'IT/Wifi',
  'General'
];

// Initial Seed Complaints demonstrating the complete 3-role lifecycle
export const INITIAL_DEMO_COMPLAINTS = [
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
    location: 'Hostel Block B, Floor 3, Corridor near Room 312',
    locationDetails: {
      block: 'Hostel Block B',
      floor: '3rd Floor',
      room: 'Corridor',
      details: 'Near Access Point AP-304'
    },
    urgency: 'High',
    priority: 'High',
    status: 'Submitted',
    imageUrl: null,
    imagePath: null,
    resolutionImageUrl: null,
    assignedFacultyId: null,
    assignedFacultyName: 'Unassigned',
    assignedTo: 'Unassigned',
    adminRemarks: '',
    facultyRemarks: '',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    resolvedAt: null,
    closedAt: null,
    feedback: null,
    timeline: [
      {
        id: 't-101',
        action: 'complaint_submitted',
        fromStatus: null,
        toStatus: 'Submitted',
        status: 'Submitted',
        title: 'Complaint Submitted',
        note: 'Complaint lodged by student and assigned ticket ID CC-2026-1001.',
        performedBy: 'demo-student-id',
        performedByName: 'Alex Morgan',
        performedByRole: 'student',
        updatedByName: 'Alex Morgan',
        updatedByRole: 'student',
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString()
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
    category: 'Academics',
    title: 'Overhead projector HDMI signal cutting off in Seminar Hall 1',
    description: 'The digital projector in Seminar Hall 1 continuously disconnects during PowerPoint presentations and lectures. Needs port or cable replacement.',
    location: 'Main Academic Block, 1st Floor, Seminar Hall 1',
    locationDetails: {
      block: 'Main Academic Block',
      floor: '1st Floor',
      room: 'Seminar Hall 1',
      details: 'Podium HDMI interface'
    },
    urgency: 'High',
    priority: 'High',
    status: 'Assigned',
    imageUrl: null,
    imagePath: null,
    resolutionImageUrl: null,
    assignedFacultyId: 'demo-faculty-id',
    assignedFacultyName: 'Prof. Sarah Jenkins',
    assignedTo: 'Prof. Sarah Jenkins',
    adminRemarks: 'Assigned to CSE faculty lead for department lab/hall inspection.',
    facultyRemarks: '',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    resolvedAt: null,
    closedAt: null,
    feedback: null,
    timeline: [
      {
        id: 't-102a',
        action: 'complaint_submitted',
        status: 'Submitted',
        title: 'Complaint Submitted',
        note: 'Complaint lodged by student Alex Morgan.',
        performedByName: 'Alex Morgan',
        performedByRole: 'student',
        updatedByName: 'Alex Morgan',
        updatedByRole: 'student',
        timestamp: new Date(Date.now() - 86400000 * 3).toISOString()
      },
      {
        id: 't-102b',
        action: 'faculty_assigned',
        status: 'Assigned',
        title: 'Complaint Assigned to Faculty',
        note: 'Central Admin assigned complaint to Prof. Sarah Jenkins.',
        performedByName: 'Dr. Robert Vance',
        performedByRole: 'admin',
        updatedByName: 'Dr. Robert Vance',
        updatedByRole: 'admin',
        timestamp: new Date(Date.now() - 3600000 * 12).toISOString()
      }
    ]
  },
  {
    id: 'comp-103',
    ticketId: 'CC-2026-1003',
    studentId: 'demo-student-id',
    studentName: 'Alex Morgan',
    studentEmail: 'student@campuscare.edu',
    department: 'Computer Science & Engineering',
    category: 'Electrical',
    title: 'Lab workstation power sockets sparking in Lab 302',
    description: 'Two multi-plug power outlets beneath Workbench 4 are sparking intermittently when desktop monitors are powered on. Potential fire hazard.',
    location: 'Science & Tech Block, 3rd Floor, Lab 302',
    locationDetails: {
      block: 'Science & Tech Block',
      floor: '3rd Floor',
      room: 'Lab 302',
      details: 'Under Workbench 4'
    },
    urgency: 'Critical',
    priority: 'Critical',
    status: 'In Progress',
    imageUrl: null,
    imagePath: null,
    resolutionImageUrl: null,
    assignedFacultyId: 'demo-faculty-id',
    assignedFacultyName: 'Prof. Sarah Jenkins',
    assignedTo: 'Prof. Sarah Jenkins',
    adminRemarks: 'Prioritized as Critical. Coordinated with campus electrical maintenance staff.',
    facultyRemarks: 'Electrician dispatched. Power branch isolated to prevent hazard.',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    resolvedAt: null,
    closedAt: null,
    feedback: null,
    timeline: [
      {
        id: 't-103a',
        action: 'complaint_submitted',
        status: 'Submitted',
        title: 'Complaint Submitted',
        note: 'Urgent electrical complaint submitted.',
        updatedByName: 'Alex Morgan',
        updatedByRole: 'student',
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString()
      },
      {
        id: 't-103b',
        action: 'faculty_assigned',
        status: 'Assigned',
        title: 'Complaint Assigned to Faculty',
        note: 'Assigned to Prof. Sarah Jenkins with Critical priority.',
        updatedByName: 'Dr. Robert Vance',
        updatedByRole: 'admin',
        timestamp: new Date(Date.now() - 86400000 * 1.5).toISOString()
      },
      {
        id: 't-103c',
        action: 'faculty_accepted',
        status: 'Accepted',
        title: 'Faculty Accepted Complaint',
        note: 'Prof. Sarah Jenkins accepted the assignment and inspected the site.',
        updatedByName: 'Prof. Sarah Jenkins',
        updatedByRole: 'faculty',
        timestamp: new Date(Date.now() - 3600000 * 6).toISOString()
      },
      {
        id: 't-103d',
        action: 'work_started',
        status: 'In Progress',
        title: 'Work Started by Faculty',
        note: 'Maintenance staff working on replacing conduit box and circuit breaker.',
        updatedByName: 'Prof. Sarah Jenkins',
        updatedByRole: 'faculty',
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString()
      }
    ]
  },
  {
    id: 'comp-104',
    ticketId: 'CC-2026-1004',
    studentId: 'demo-student-id',
    studentName: 'Alex Morgan',
    studentEmail: 'student@campuscare.edu',
    department: 'Computer Science & Engineering',
    category: 'Hostel',
    title: 'Ceiling fan making loud squeaking noise & vibrating',
    description: 'The ceiling fan in Room 204 has a loose mounting bracket and makes loud metallic noises when set above speed 2.',
    location: 'Hostel Block B, 2nd Floor, Room 204',
    locationDetails: {
      block: 'Hostel Block B',
      floor: '2nd Floor',
      room: 'Room 204',
      details: 'Center ceiling mount'
    },
    urgency: 'Medium',
    priority: 'Medium',
    status: 'Resolved',
    imageUrl: null,
    imagePath: null,
    resolutionImageUrl: null,
    assignedFacultyId: 'demo-faculty-id',
    assignedFacultyName: 'Prof. Sarah Jenkins',
    assignedTo: 'Prof. Sarah Jenkins',
    adminRemarks: 'Forwarded to Hostel coordinator.',
    facultyRemarks: 'Tightened rod bolts, replaced mounting damping washer, and lubricated bearings. Tested at full speed.',
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    resolvedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    closedAt: null,
    feedback: null,
    timeline: [
      {
        id: 't-104a',
        action: 'complaint_submitted',
        status: 'Submitted',
        title: 'Complaint Submitted',
        note: 'Complaint lodged successfully.',
        updatedByName: 'Alex Morgan',
        updatedByRole: 'student',
        timestamp: new Date(Date.now() - 86400000 * 4).toISOString()
      },
      {
        id: 't-104b',
        action: 'faculty_assigned',
        status: 'Assigned',
        title: 'Assigned to Faculty',
        note: 'Assigned to Prof. Sarah Jenkins.',
        updatedByName: 'Dr. Robert Vance',
        updatedByRole: 'admin',
        timestamp: new Date(Date.now() - 86400000 * 3).toISOString()
      },
      {
        id: 't-104c',
        action: 'marked_resolved',
        status: 'Resolved',
        title: 'Complaint Marked Resolved',
        note: 'Tightened rod bolts, replaced damping washer, and lubricated bearings.',
        updatedByName: 'Prof. Sarah Jenkins',
        updatedByRole: 'faculty',
        timestamp: new Date(Date.now() - 86400000 * 1).toISOString()
      }
    ]
  },
  {
    id: 'comp-105',
    ticketId: 'CC-2026-1005',
    studentId: 'demo-student-id',
    studentName: 'Alex Morgan',
    studentEmail: 'student@campuscare.edu',
    department: 'Computer Science & Engineering',
    category: 'Infrastructure',
    title: 'Drinking water dispenser tap leaking on 2nd Floor Corridor',
    description: 'The cold water tap on the water purifier unit has a broken seal and continuously leaks water onto the hallway tile floor.',
    location: 'Main Academic Block, 2nd Floor, Water Station',
    locationDetails: {
      block: 'Main Academic Block',
      floor: '2nd Floor',
      room: 'Water Station',
      details: 'Near Staircase 2'
    },
    urgency: 'Low',
    priority: 'Low',
    status: 'Closed',
    imageUrl: null,
    imagePath: null,
    resolutionImageUrl: null,
    assignedFacultyId: 'demo-faculty-id',
    assignedFacultyName: 'Prof. Sarah Jenkins',
    assignedTo: 'Prof. Sarah Jenkins',
    adminRemarks: 'Verified and approved closure after student feedback.',
    facultyRemarks: 'Replaced silicone tap valve and cleaned drainage catch.',
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    resolvedAt: new Date(Date.now() - 86400000 * 2.5).toISOString(),
    closedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    feedback: {
      rating: 5,
      comment: 'Maintenance team replaced the tap quickly. No more leakage!',
      submittedAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    timeline: [
      {
        id: 't-105a',
        action: 'complaint_submitted',
        status: 'Submitted',
        title: 'Complaint Submitted',
        note: 'Complaint lodged by student.',
        updatedByName: 'Alex Morgan',
        updatedByRole: 'student',
        timestamp: new Date(Date.now() - 86400000 * 6).toISOString()
      },
      {
        id: 't-105b',
        action: 'marked_resolved',
        status: 'Resolved',
        title: 'Complaint Marked Resolved',
        note: 'Replaced silicone tap valve and cleaned drainage catch.',
        updatedByName: 'Prof. Sarah Jenkins',
        updatedByRole: 'faculty',
        timestamp: new Date(Date.now() - 86400000 * 2.5).toISOString()
      },
      {
        id: 't-105c',
        action: 'feedback_submitted',
        status: 'Closed',
        title: 'Feedback Submitted & Ticket Closed',
        note: 'Student rated resolution 5/5 stars.',
        updatedByName: 'Alex Morgan',
        updatedByRole: 'student',
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString()
      }
    ]
  },
  {
    id: 'comp-106',
    ticketId: 'CC-2026-1006',
    studentId: 'demo-student-id',
    studentName: 'Alex Morgan',
    studentEmail: 'student@campuscare.edu',
    department: 'Computer Science & Engineering',
    category: 'Electrical',
    title: 'Air conditioner compressor failure in Room 108',
    description: 'The split AC unit blows ambient air without cooling. Fan runs but compressor trips within 2 minutes of turning on.',
    location: 'Hostel Block B, 1st Floor, Room 108',
    locationDetails: {
      block: 'Hostel Block B',
      floor: '1st Floor',
      room: 'Room 108',
      details: 'Window unit'
    },
    urgency: 'High',
    priority: 'High',
    status: 'Reopened',
    imageUrl: null,
    imagePath: null,
    resolutionImageUrl: null,
    assignedFacultyId: 'demo-faculty-id',
    assignedFacultyName: 'Prof. Sarah Jenkins',
    assignedTo: 'Prof. Sarah Jenkins',
    adminRemarks: 'Reopened by student reporting cooling stopped again after initial technician visit.',
    facultyRemarks: 'Awaiting specialized HVAC technician for refrigerant leak check.',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    resolvedAt: null,
    closedAt: null,
    feedback: null,
    timeline: [
      {
        id: 't-106a',
        action: 'complaint_submitted',
        status: 'Submitted',
        title: 'Complaint Submitted',
        note: 'AC complaint lodged.',
        updatedByName: 'Alex Morgan',
        updatedByRole: 'student',
        timestamp: new Date(Date.now() - 86400000 * 5).toISOString()
      },
      {
        id: 't-106b',
        action: 'marked_resolved',
        status: 'Resolved',
        title: 'Complaint Marked Resolved',
        note: 'Filter cleaned and capacitor replaced.',
        updatedByName: 'Prof. Sarah Jenkins',
        updatedByRole: 'faculty',
        timestamp: new Date(Date.now() - 86400000 * 1).toISOString()
      },
      {
        id: 't-106c',
        action: 'complaint_reopened',
        status: 'Reopened',
        title: 'Complaint Reopened by Student',
        note: 'Student reported cooling stopped working again after 2 hours.',
        updatedByName: 'Alex Morgan',
        updatedByRole: 'student',
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString()
      }
    ]
  }
];

export function resetDemoComplaints() {
  localStorage.setItem('campuscare_complaints', JSON.stringify(INITIAL_DEMO_COMPLAINTS));
  return INITIAL_DEMO_COMPLAINTS;
}

export function getDemoComplaints() {
  const raw = localStorage.getItem('campuscare_complaints');
  if (!raw) {
    localStorage.setItem('campuscare_complaints', JSON.stringify(INITIAL_DEMO_COMPLAINTS));
    return INITIAL_DEMO_COMPLAINTS;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.length === 0) {
      localStorage.setItem('campuscare_complaints', JSON.stringify(INITIAL_DEMO_COMPLAINTS));
      return INITIAL_DEMO_COMPLAINTS;
    }
    return parsed;
  } catch (e) {
    return INITIAL_DEMO_COMPLAINTS;
  }
}

export function saveDemoComplaints(list) {
  localStorage.setItem('campuscare_complaints', JSON.stringify(list));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('campuscare_complaints_updated', { detail: list }));
  }
}

/* ==========================================================================
   Category Management Helpers
   ========================================================================== */

export function getCategories() {
  try {
    const raw = localStorage.getItem('campuscare_categories');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  localStorage.setItem('campuscare_categories', JSON.stringify(DEFAULT_CATEGORIES));
  return DEFAULT_CATEGORIES;
}

export function createCategory(name) {
  const cats = getCategories();
  const clean = (name || '').trim();
  if (!clean || cats.includes(clean)) return cats;
  cats.push(clean);
  localStorage.setItem('campuscare_categories', JSON.stringify(cats));
  return cats;
}

export function updateCategory(oldName, newName) {
  const cats = getCategories();
  const idx = cats.indexOf(oldName);
  if (idx !== -1 && newName && !cats.includes(newName.trim())) {
    cats[idx] = newName.trim();
    localStorage.setItem('campuscare_categories', JSON.stringify(cats));
  }
  return cats;
}

export function deleteCategory(name) {
  let cats = getCategories();
  cats = cats.filter(c => c !== name);
  localStorage.setItem('campuscare_categories', JSON.stringify(cats));
  return cats;
}

/* ==========================================================================
   1. STUDENT SERVICE METHODS
   ========================================================================== */

/**
 * Student: Raise a new complaint document + initial timeline event
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

  // Format location support (both object structure and string for max compatibility)
  let locationStr = 'N/A';
  let locationDetails = {};
  if (typeof complaintData.location === 'object' && complaintData.location !== null) {
    locationDetails = complaintData.location;
    locationStr = [
      locationDetails.block ? `Block: ${locationDetails.block}` : '',
      locationDetails.floor ? `Floor: ${locationDetails.floor}` : '',
      locationDetails.room ? `Room: ${locationDetails.room}` : '',
      locationDetails.details || ''
    ].filter(Boolean).join(', ');
  } else if (typeof complaintData.location === 'string') {
    locationStr = complaintData.location;
    locationDetails = { details: complaintData.location };
  }

  const priorityVal = complaintData.priority || complaintData.urgency || 'Medium';

  const initialTimelineEvent = {
    id: 't-' + Date.now(),
    action: 'complaint_submitted',
    fromStatus: null,
    toStatus: 'Submitted',
    status: 'Submitted',
    title: 'Complaint Submitted',
    note: `Complaint lodged and assigned ticket ID ${ticketId}.`,
    performedBy: studentProfile.uid,
    performedByName: studentProfile.fullName || 'Student',
    performedByRole: 'student',
    updatedByName: studentProfile.fullName || 'Student',
    updatedByRole: 'student',
    timestamp: new Date().toISOString()
  };

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
    location: locationStr,
    locationDetails,
    urgency: priorityVal,
    priority: priorityVal,
    status: 'Submitted',
    imageUrl,
    imagePath,
    resolutionImageUrl: null,
    assignedFacultyId: null,
    assignedFacultyName: 'Unassigned',
    assignedTo: 'Unassigned',
    adminRemarks: '',
    facultyRemarks: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
    closedAt: null,
    feedback: null,
    timeline: [initialTimelineEvent]
  };

  try {
    const complaintRef = doc(db, 'complaints', complaintId);
    await setDoc(complaintRef, payload);
    await addDoc(collection(db, `complaints/${complaintId}/timeline`), {
      ...initialTimelineEvent,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.warn('Firestore write failed (using local demo database):', err.message);
  }

  // Always update local demo state
  const localList = getDemoComplaints();
  localList.unshift(payload);
  saveDemoComplaints(localList);

  // Send in-app notification to student
  sendNotification(
    studentProfile.uid,
    ticketId,
    complaintId,
    `Complaint ${ticketId} submitted successfully. Central Admin will review and assign faculty.`,
    'status_update',
    'student'
  );

  return payload;
}

/**
 * Student: Fetch own complaints
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
  return localList.filter(c => c.studentId === studentId || studentId === 'demo-student-id')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Student alias
export const getMyComplaints = getStudentComplaints;

/**
 * Student: Search and filter own complaints
 */
export async function searchStudentComplaints(studentId, { searchQuery = '', category = 'ALL', status = 'ALL' } = {}) {
  let list = await getStudentComplaints(studentId);

  if (category && category !== 'ALL') {
    list = list.filter(c => c.category === category);
  }
  if (status && status !== 'ALL') {
    list = list.filter(c => c.status === status);
  }
  if (searchQuery && searchQuery.trim() !== '') {
    const term = searchQuery.toLowerCase().trim();
    list = list.filter(c => 
      (c.ticketId && c.ticketId.toLowerCase().includes(term)) ||
      (c.title && c.title.toLowerCase().includes(term)) ||
      (c.category && c.category.toLowerCase().includes(term)) ||
      (c.status && c.status.toLowerCase().includes(term))
    );
  }
  return list;
}

/**
 * Student: Cancel complaint when allowed (Submitted or Assigned)
 */
export async function cancelComplaint(complaintId, studentUser, reason = '') {
  const details = await getComplaintDetails(complaintId);
  if (!details) throw new Error('Complaint not found.');

  // Validate state
  const cancellableStates = ['Submitted', 'Assigned'];
  if (!cancellableStates.includes(details.status)) {
    throw new Error(`Cannot cancel a complaint that is already '${details.status}'. Only Submitted or Assigned complaints can be cancelled.`);
  }

  const newTimelineEvent = {
    id: 't-' + Date.now(),
    action: 'complaint_cancelled',
    fromStatus: details.status,
    toStatus: 'Closed',
    status: 'Closed',
    title: 'Complaint Cancelled by Student',
    note: reason ? `Cancelled by student. Reason: "${reason}"` : 'Complaint cancelled by the student.',
    performedBy: studentUser.uid,
    performedByName: studentUser.fullName || 'Student',
    performedByRole: 'student',
    updatedByName: studentUser.fullName || 'Student',
    updatedByRole: 'student',
    timestamp: new Date().toISOString()
  };

  try {
    const complaintRef = doc(db, 'complaints', complaintId);
    await updateDoc(complaintRef, {
      status: 'Closed',
      closedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await addDoc(collection(db, `complaints/${complaintId}/timeline`), {
      ...newTimelineEvent,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn('Firestore cancelComplaint failed (using demo fallback):', e.message);
  }

  const localList = getDemoComplaints();
  const target = localList.find(c => c.id === complaintId);
  if (target) {
    target.status = 'Closed';
    target.closedAt = new Date().toISOString();
    target.updatedAt = new Date().toISOString();
    target.timeline = target.timeline || [];
    target.timeline.push(newTimelineEvent);
    saveDemoComplaints(localList);
  }

  return { success: true };
}

/**
 * Student: Reopen complaint after resolution if issue persists
 */
export async function reopenComplaint(complaintId, studentUser, reason = '') {
  const details = await getComplaintDetails(complaintId);
  if (!details) throw new Error('Complaint not found.');

  if (details.status !== 'Resolved' && details.status !== 'Closed') {
    throw new Error(`Only Resolved or Closed complaints can be reopened.`);
  }

  const newTimelineEvent = {
    id: 't-' + Date.now(),
    action: 'complaint_reopened',
    fromStatus: details.status,
    toStatus: 'Reopened',
    status: 'Reopened',
    title: 'Complaint Reopened by Student',
    note: reason ? `Student reported issue unresolved: "${reason}"` : 'Student reopened this complaint.',
    performedBy: studentUser.uid,
    performedByName: studentUser.fullName || 'Student',
    performedByRole: 'student',
    updatedByName: studentUser.fullName || 'Student',
    updatedByRole: 'student',
    timestamp: new Date().toISOString()
  };

  try {
    const complaintRef = doc(db, 'complaints', complaintId);
    await updateDoc(complaintRef, {
      status: 'Reopened',
      resolvedAt: null,
      updatedAt: serverTimestamp()
    });
    await addDoc(collection(db, `complaints/${complaintId}/timeline`), {
      ...newTimelineEvent,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn('Firestore reopenComplaint failed (using demo fallback):', e.message);
  }

  const localList = getDemoComplaints();
  const target = localList.find(c => c.id === complaintId);
  if (target) {
    target.status = 'Reopened';
    target.resolvedAt = null;
    target.updatedAt = new Date().toISOString();
    target.timeline = target.timeline || [];
    target.timeline.push(newTimelineEvent);
    saveDemoComplaints(localList);

    // Notify assigned faculty if present
    if (target.assignedFacultyId) {
      sendNotification(
        target.assignedFacultyId,
        target.ticketId,
        target.id,
        `Student reopened ticket ${target.ticketId}. Reason: "${reason || 'Unresolved'}"`,
        'reopened',
        'faculty'
      );
    }
  }

  return { success: true };
}

/**
 * Student: Submit 1-5 star rating and feedback review
 */
export async function submitComplaintFeedback(complaintId, rating, comment = '') {
  const feedbackData = {
    rating: Number(rating),
    comment: comment || '',
    submittedAt: new Date().toISOString()
  };

  const newTimelineEvent = {
    id: 't-' + Date.now(),
    action: 'feedback_submitted',
    fromStatus: 'Resolved',
    toStatus: 'Closed',
    status: 'Closed',
    title: 'Feedback Submitted & Ticket Closed',
    note: `Student rated resolution ${rating}/5 stars. "${comment || 'No comment provided.'}"`,
    performedBy: 'student',
    performedByName: 'Student',
    performedByRole: 'student',
    updatedByName: 'Student',
    updatedByRole: 'student',
    timestamp: new Date().toISOString()
  };

  try {
    const complaintRef = doc(db, 'complaints', complaintId);
    await updateDoc(complaintRef, {
      feedback: feedbackData,
      status: 'Closed',
      closedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await addDoc(collection(db, `complaints/${complaintId}/timeline`), {
      ...newTimelineEvent,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.warn('Firestore feedback update failed (updating demo fallback):', err.message);
  }

  const localList = getDemoComplaints();
  const target = localList.find(c => c.id === complaintId);
  if (target) {
    target.feedback = feedbackData;
    target.status = 'Closed';
    target.closedAt = new Date().toISOString();
    target.updatedAt = new Date().toISOString();
    target.timeline = target.timeline || [];
    target.timeline.push(newTimelineEvent);
    saveDemoComplaints(localList);
  }
}

export const submitRating = (complaintId, rating) => submitComplaintFeedback(complaintId, rating, '');
export const submitFeedback = submitComplaintFeedback;

export async function getStudentFeedbackComplaints(studentId) {
  const complaints = await getStudentComplaints(studentId);
  return complaints.filter(c => c.status === 'Resolved' || c.status === 'Closed' || c.feedback != null);
}

/* ==========================================================================
   2. FACULTY SERVICE METHODS
   ========================================================================== */

/**
 * Faculty: Get complaints assigned to this faculty member ONLY
 */
export async function getAssignedComplaints(facultyId, filters = {}) {
  let list = [];

  try {
    const q = query(collection(db, 'complaints'), where('assignedFacultyId', '==', facultyId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  } catch (err) {
    console.warn('Firestore getAssignedComplaints failed (using fallback):', err.message);
  }

  if (list.length === 0) {
    const localList = getDemoComplaints();
    list = localList.filter(c => 
      c.assignedFacultyId === facultyId || 
      facultyId === 'demo-faculty-id' ||
      c.assignedFacultyId === 'demo-faculty-id' ||
      (c.assignedFacultyName && c.assignedFacultyName.includes('Jenkins'))
    );
  }

  // Apply filters
  if (filters.status && filters.status !== 'ALL') {
    list = list.filter(item => item.status === filters.status);
  }
  if (filters.category && filters.category !== 'ALL') {
    list = list.filter(item => item.category === filters.category);
  }
  if (filters.priority && filters.priority !== 'ALL') {
    list = list.filter(item => item.urgency === filters.priority || item.priority === filters.priority);
  }
  if (filters.searchQuery) {
    const qLower = filters.searchQuery.toLowerCase().trim();
    list = list.filter(item => 
      (item.ticketId && item.ticketId.toLowerCase().includes(qLower)) ||
      (item.title && item.title.toLowerCase().includes(qLower)) ||
      (item.studentName && item.studentName.toLowerCase().includes(qLower)) ||
      (item.location && item.location.toLowerCase().includes(qLower))
    );
  }

  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Faculty: Get single complaint details with ownership check
 */
export async function getAssignedComplaintById(complaintId, facultyId) {
  const complaint = await getComplaintDetails(complaintId);
  if (!complaint) return null;
  // Verify assignment or allow viewing unassigned submitted complaints to self-assign
  const isAssigned = 
    complaint.assignedFacultyId === facultyId || 
    facultyId === 'demo-faculty-id' ||
    complaint.assignedFacultyId === 'demo-faculty-id' ||
    complaint.status === 'Submitted' ||
    (complaint.assignedFacultyName && complaint.assignedFacultyName.includes('Jenkins'));

  if (!isAssigned) {
    throw new Error('Access denied: You can only view complaints assigned to you.');
  }
  return complaint;
}

/**
 * Faculty: Accept an assigned complaint
 */
export async function acceptComplaint(complaintId, facultyUser, notes = '') {
  const details = await getComplaintDetails(complaintId);
  if (!details) throw new Error('Complaint not found.');

  const newTimelineEvent = {
    id: 't-' + Date.now(),
    action: 'faculty_accepted',
    fromStatus: details.status,
    toStatus: 'Accepted',
    status: 'Accepted',
    title: 'Faculty Accepted Complaint',
    note: notes || `Accepted by ${facultyUser.fullName || 'Faculty'}. Preparation for resolution underway.`,
    performedBy: facultyUser.uid,
    performedByName: facultyUser.fullName || 'Faculty Member',
    performedByRole: 'faculty',
    updatedByName: facultyUser.fullName || 'Faculty Member',
    updatedByRole: 'faculty',
    timestamp: new Date().toISOString()
  };

  try {
    const ref = doc(db, 'complaints', complaintId);
    await updateDoc(ref, {
      status: 'Accepted',
      acceptedAt: serverTimestamp(),
      facultyRemarks: notes || details.facultyRemarks || '',
      updatedAt: serverTimestamp()
    });
    await addDoc(collection(db, `complaints/${complaintId}/timeline`), {
      ...newTimelineEvent,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn('Firestore acceptComplaint failed (using demo fallback):', e.message);
  }

  const localList = getDemoComplaints();
  const target = localList.find(c => c.id === complaintId);
  if (target) {
    target.status = 'Accepted';
    target.acceptedAt = new Date().toISOString();
    target.facultyRemarks = notes || target.facultyRemarks || '';
    target.updatedAt = new Date().toISOString();
    target.timeline = target.timeline || [];
    target.timeline.push(newTimelineEvent);
    saveDemoComplaints(localList);

    if (target.studentId) {
      sendNotification(
        target.studentId,
        target.ticketId,
        target.id,
        `Faculty member ${facultyUser.fullName || 'Faculty'} accepted your complaint ${target.ticketId}.`,
        'status_update',
        'student'
      );
    }
  }

  return { success: true };
}

/**
 * Faculty: Start work on complaint
 */
export async function startWork(complaintId, facultyUser, notes = '') {
  const details = await getComplaintDetails(complaintId);
  if (!details) throw new Error('Complaint not found.');

  const newTimelineEvent = {
    id: 't-' + Date.now(),
    action: 'work_started',
    fromStatus: details.status,
    toStatus: 'In Progress',
    status: 'In Progress',
    title: 'Work Started by Faculty',
    note: notes || `Resolution work initiated by ${facultyUser.fullName || 'Faculty'}.`,
    performedBy: facultyUser.uid,
    performedByName: facultyUser.fullName || 'Faculty Member',
    performedByRole: 'faculty',
    updatedByName: facultyUser.fullName || 'Faculty Member',
    updatedByRole: 'faculty',
    timestamp: new Date().toISOString()
  };

  try {
    const ref = doc(db, 'complaints', complaintId);
    await updateDoc(ref, {
      status: 'In Progress',
      facultyRemarks: notes || details.facultyRemarks || '',
      updatedAt: serverTimestamp()
    });
    await addDoc(collection(db, `complaints/${complaintId}/timeline`), {
      ...newTimelineEvent,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn('Firestore startWork failed (using fallback):', e.message);
  }

  const localList = getDemoComplaints();
  const target = localList.find(c => c.id === complaintId);
  if (target) {
    target.status = 'In Progress';
    target.facultyRemarks = notes || target.facultyRemarks || '';
    target.updatedAt = new Date().toISOString();
    target.timeline = target.timeline || [];
    target.timeline.push(newTimelineEvent);
    saveDemoComplaints(localList);

    if (target.studentId) {
      sendNotification(
        target.studentId,
        target.ticketId,
        target.id,
        `Work started on ticket ${target.ticketId} by ${facultyUser.fullName || 'Faculty'}.`,
        'status_update',
        'student'
      );
    }
  }

  return { success: true };
}

/**
 * Faculty: Update progress / add note
 */
export async function updateComplaintProgress(complaintId, facultyUser, progressNotes) {
  return await addFacultyNote(complaintId, facultyUser, progressNotes, 'Progress Updated');
}

export async function addFacultyNote(complaintId, facultyUser, noteText, title = 'Faculty Added Note') {
  if (!noteText || !noteText.trim()) throw new Error('Note text is required.');

  const newTimelineEvent = {
    id: 't-' + Date.now(),
    action: 'faculty_note',
    status: 'In Progress',
    title,
    note: noteText.trim(),
    performedBy: facultyUser.uid,
    performedByName: facultyUser.fullName || 'Faculty Member',
    performedByRole: 'faculty',
    updatedByName: facultyUser.fullName || 'Faculty Member',
    updatedByRole: 'faculty',
    timestamp: new Date().toISOString()
  };

  try {
    const ref = doc(db, 'complaints', complaintId);
    await updateDoc(ref, {
      facultyRemarks: noteText.trim(),
      updatedAt: serverTimestamp()
    });
    await addDoc(collection(db, `complaints/${complaintId}/timeline`), {
      ...newTimelineEvent,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn('Firestore addFacultyNote failed:', e.message);
  }

  const localList = getDemoComplaints();
  const target = localList.find(c => c.id === complaintId);
  if (target) {
    target.facultyRemarks = noteText.trim();
    target.updatedAt = new Date().toISOString();
    target.timeline = target.timeline || [];
    target.timeline.push(newTimelineEvent);
    saveDemoComplaints(localList);
  }

  return { success: true };
}

/**
 * Faculty: Upload resolution evidence image
 */
export async function uploadResolutionEvidence(complaintId, imageFile) {
  if (!imageFile) return null;
  return await uploadComplaintImage(complaintId, imageFile);
}

/**
 * Faculty: Mark complaint as Resolved (with resolution evidence)
 */
export async function markComplaintResolved(complaintId, facultyUser, resolutionNotes, evidenceFile = null) {
  let resolutionImageUrl = null;
  if (evidenceFile) {
    const uploadRes = await uploadComplaintImage(complaintId, evidenceFile);
    if (uploadRes) resolutionImageUrl = uploadRes.url;
  }

  const newTimelineEvent = {
    id: 't-' + Date.now(),
    action: 'marked_resolved',
    fromStatus: 'In Progress',
    toStatus: 'Resolved',
    status: 'Resolved',
    title: 'Complaint Marked Resolved',
    note: resolutionNotes || `Complaint resolved by ${facultyUser.fullName || 'Faculty'}. Awaiting student verification.`,
    performedBy: facultyUser.uid,
    performedByName: facultyUser.fullName || 'Faculty Member',
    performedByRole: 'faculty',
    updatedByName: facultyUser.fullName || 'Faculty Member',
    updatedByRole: 'faculty',
    timestamp: new Date().toISOString()
  };

  try {
    const ref = doc(db, 'complaints', complaintId);
    const updateData = {
      status: 'Resolved',
      facultyRemarks: resolutionNotes || '',
      resolvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (resolutionImageUrl) updateData.resolutionImageUrl = resolutionImageUrl;

    await updateDoc(ref, updateData);
    await addDoc(collection(db, `complaints/${complaintId}/timeline`), {
      ...newTimelineEvent,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn('Firestore markComplaintResolved failed (using fallback):', e.message);
  }

  const localList = getDemoComplaints();
  const target = localList.find(c => c.id === complaintId);
  if (target) {
    target.status = 'Resolved';
    target.facultyRemarks = resolutionNotes || '';
    if (resolutionImageUrl) target.resolutionImageUrl = resolutionImageUrl;
    target.resolvedAt = new Date().toISOString();
    target.updatedAt = new Date().toISOString();
    target.timeline = target.timeline || [];
    target.timeline.push(newTimelineEvent);
    saveDemoComplaints(localList);

    if (target.studentId) {
      sendNotification(
        target.studentId,
        target.ticketId,
        target.id,
        `Your complaint ${target.ticketId} has been resolved! Please rate the resolution.`,
        'resolved',
        'student'
      );
    }
  }

  return { success: true };
}

/**
 * Faculty: Request reassignment to Admin
 */
export async function requestReassignment(complaintId, facultyUser, reason = '') {
  const newTimelineEvent = {
    id: 't-' + Date.now(),
    action: 'reassignment_requested',
    title: 'Faculty Requested Reassignment',
    note: `Reassignment requested by ${facultyUser.fullName || 'Faculty'}. Reason: "${reason || 'Requires different department specialization.'}"`,
    performedBy: facultyUser.uid,
    performedByName: facultyUser.fullName || 'Faculty Member',
    performedByRole: 'faculty',
    updatedByName: facultyUser.fullName || 'Faculty Member',
    updatedByRole: 'faculty',
    timestamp: new Date().toISOString()
  };

  try {
    const ref = doc(db, 'complaints', complaintId);
    await addDoc(collection(db, `complaints/${complaintId}/timeline`), {
      ...newTimelineEvent,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn('Firestore requestReassignment failed:', e.message);
  }

  const localList = getDemoComplaints();
  const target = localList.find(c => c.id === complaintId);
  if (target) {
    target.timeline = target.timeline || [];
    target.timeline.push(newTimelineEvent);
    target.updatedAt = new Date().toISOString();
    saveDemoComplaints(localList);
  }

  return { success: true };
}

/* ==========================================================================
   3. ADMIN SERVICE METHODS
   ========================================================================== */

/**
 * Admin: Fetch all complaints (Global view)
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
    list = list.filter(item => item.urgency === filters.urgency || item.priority === filters.urgency);
  }
  if (filters.assignedFaculty && filters.assignedFaculty !== 'ALL') {
    list = list.filter(item => item.assignedFacultyId === filters.assignedFaculty || item.assignedFacultyName === filters.assignedFaculty);
  }
  if (filters.searchQuery) {
    const qLower = filters.searchQuery.toLowerCase().trim();
    list = list.filter(item => 
      (item.ticketId && item.ticketId.toLowerCase().includes(qLower)) ||
      (item.title && item.title.toLowerCase().includes(qLower)) ||
      (item.studentName && item.studentName.toLowerCase().includes(qLower)) ||
      (item.studentId && item.studentId.toLowerCase().includes(qLower)) ||
      (item.department && item.department.toLowerCase().includes(qLower)) ||
      (item.assignedFacultyName && item.assignedFacultyName.toLowerCase().includes(qLower))
    );
  }

  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export const searchComplaints = (queryStr, filters = {}) => getAllComplaints({ ...filters, searchQuery: queryStr });
export const filterComplaints = (filters = {}) => getAllComplaints(filters);

/**
 * Single complaint details & full timeline retrieval
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
    console.warn('Firestore getComplaintDetails failed, using demo fallback:', err.message);
  }

  const localList = getDemoComplaints();
  const found = localList.find(c => c.id === complaintId || c.ticketId === complaintId);
  return found || null;
}

export const getComplaintById = getComplaintDetails;
export const trackComplaintStatus = getComplaintDetails;
export async function getComplaintTimeline(complaintId) {
  const details = await getComplaintDetails(complaintId);
  return details ? details.timeline || [] : [];
}

/**
 * Admin: Assign complaint to a Faculty member
 */
export async function assignComplaintToFaculty(complaintId, adminUser, facultyId, facultyName, remarks = '') {
  const details = await getComplaintDetails(complaintId);
  if (!details) throw new Error('Complaint not found.');

  const newTimelineEvent = {
    id: 't-' + Date.now(),
    action: 'faculty_assigned',
    fromStatus: details.status,
    toStatus: 'Assigned',
    status: 'Assigned',
    title: 'Complaint Assigned to Faculty',
    note: remarks ? `Assigned to ${facultyName}. Instructions: "${remarks}"` : `Assigned to ${facultyName}.`,
    performedBy: adminUser.uid,
    performedByName: adminUser.fullName || 'Central Administrator',
    performedByRole: 'admin',
    updatedByName: adminUser.fullName || 'Central Administrator',
    updatedByRole: 'admin',
    timestamp: new Date().toISOString()
  };

  try {
    const ref = doc(db, 'complaints', complaintId);
    await updateDoc(ref, {
      status: 'Assigned',
      assignedFacultyId: facultyId,
      assignedFacultyName: facultyName,
      assignedTo: facultyName,
      adminRemarks: remarks || details.adminRemarks || '',
      updatedAt: serverTimestamp()
    });
    await addDoc(collection(db, `complaints/${complaintId}/timeline`), {
      ...newTimelineEvent,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn('Firestore assignComplaintToFaculty error:', e.message);
  }

  const localList = getDemoComplaints();
  const target = localList.find(c => c.id === complaintId);
  if (target) {
    target.status = 'Assigned';
    target.assignedFacultyId = facultyId;
    target.assignedFacultyName = facultyName;
    target.assignedTo = facultyName;
    target.adminRemarks = remarks || target.adminRemarks || '';
    target.updatedAt = new Date().toISOString();
    target.timeline = target.timeline || [];
    target.timeline.push(newTimelineEvent);
    saveDemoComplaints(localList);

    // Notify Faculty
    sendNotification(
      facultyId,
      target.ticketId,
      target.id,
      `New complaint ticket ${target.ticketId} (${target.title}) has been assigned to you.`,
      'new_assignment',
      'faculty'
    );

    // Notify Student
    if (target.studentId) {
      sendNotification(
        target.studentId,
        target.ticketId,
        target.id,
        `Your complaint ${target.ticketId} has been assigned to ${facultyName}.`,
        'status_update',
        'student'
      );
    }
  }

  return { success: true };
}

/**
 * Admin: Reassign complaint to another Faculty member
 */
export async function reassignComplaint(complaintId, adminUser, newFacultyId, newFacultyName, remarks = '') {
  return await assignComplaintToFaculty(complaintId, adminUser, newFacultyId, newFacultyName, remarks);
}

/**
 * Admin: Update complaint status & push timeline event
 */
export async function updateComplaintStatus(complaintId, adminUser, status, remarks = '', assignedTo = null) {
  const details = await getComplaintDetails(complaintId);
  const previousStatus = details ? details.status : 'Submitted';

  const newTimelineEvent = {
    id: 't-' + Date.now(),
    action: 'status_changed',
    fromStatus: previousStatus,
    toStatus: status,
    status,
    title: `Status updated to ${status}`,
    note: remarks || `Complaint status updated to ${status} by Admin (${adminUser.fullName || 'Admin'}).`,
    performedBy: adminUser.uid,
    performedByName: adminUser.fullName || 'Administrator',
    performedByRole: 'admin',
    updatedByName: adminUser.fullName || 'Administrator',
    updatedByRole: 'admin',
    timestamp: new Date().toISOString()
  };

  try {
    const complaintRef = doc(db, 'complaints', complaintId);
    const updateData = { 
      status, 
      adminRemarks: remarks || '', 
      updatedAt: serverTimestamp() 
    };
    if (assignedTo) updateData.assignedTo = assignedTo;
    if (status === 'Resolved') updateData.resolvedAt = serverTimestamp();
    if (status === 'Closed') updateData.closedAt = serverTimestamp();

    await updateDoc(complaintRef, updateData);
    await addDoc(collection(db, `complaints/${complaintId}/timeline`), {
      ...newTimelineEvent,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.warn('Firestore status update failed (updating demo fallback):', err.message);
  }

  const localList = getDemoComplaints();
  const target = localList.find(c => c.id === complaintId);
  if (target) {
    target.status = status;
    target.adminRemarks = remarks || '';
    if (assignedTo) target.assignedTo = assignedTo;
    if (status === 'Resolved') target.resolvedAt = new Date().toISOString();
    if (status === 'Closed') target.closedAt = new Date().toISOString();
    target.updatedAt = new Date().toISOString();
    target.timeline = target.timeline || [];
    target.timeline.push(newTimelineEvent);
    saveDemoComplaints(localList);

    if (target.studentId) {
      sendNotification(
        target.studentId,
        target.ticketId,
        target.id,
        `Your complaint ticket ${target.ticketId} was updated to ${status}.`,
        'status_update',
        'student'
      );
    }
  }

  return { success: true };
}

/**
 * Admin: Add internal note / update
 */
export async function addAdminNote(complaintId, adminUser, noteText) {
  const newTimelineEvent = {
    id: 't-' + Date.now(),
    action: 'admin_note',
    title: 'Admin Added Internal Note',
    note: noteText,
    performedBy: adminUser.uid,
    performedByName: adminUser.fullName || 'Administrator',
    performedByRole: 'admin',
    updatedByName: adminUser.fullName || 'Administrator',
    updatedByRole: 'admin',
    timestamp: new Date().toISOString()
  };

  try {
    const ref = doc(db, 'complaints', complaintId);
    await addDoc(collection(db, `complaints/${complaintId}/timeline`), {
      ...newTimelineEvent,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn('Firestore addAdminNote failed:', e.message);
  }

  const localList = getDemoComplaints();
  const target = localList.find(c => c.id === complaintId);
  if (target) {
    target.timeline = target.timeline || [];
    target.timeline.push(newTimelineEvent);
    saveDemoComplaints(localList);
  }

  return { success: true };
}

export const addTimelineEvent = addAdminNote;

/**
 * Admin: Reject complaint with reason
 */
export async function rejectComplaint(complaintId, adminUser, reason = '') {
  return await updateComplaintStatus(
    complaintId, 
    adminUser, 
    'Rejected', 
    reason || 'Complaint rejected after administrative review.'
  );
}

/**
 * Admin: Verify faculty resolution & close ticket
 */
export async function closeComplaint(complaintId, adminUser, remarks = '') {
  return await updateComplaintStatus(
    complaintId, 
    adminUser, 
    'Closed', 
    remarks || 'Resolution verified by central administration. Complaint closed.'
  );
}

/**
 * Admin: Reopen complaint
 */
export async function reopenComplaintByAdmin(complaintId, adminUser, remarks = '') {
  return await updateComplaintStatus(
    complaintId, 
    adminUser, 
    'Reopened', 
    remarks || 'Reopened by central administration for further resolution.'
  );
}

/**
 * Admin: Delete a complaint document
 */
export async function deleteComplaint(complaintId) {
  try {
    const complaintRef = doc(db, 'complaints', complaintId);
    await deleteDoc(complaintRef);
  } catch (err) {
    console.warn('Firestore delete doc failed:', err.message);
  }

  const localList = getDemoComplaints();
  const updatedList = localList.filter(c => c.id !== complaintId);
  saveDemoComplaints(updatedList);
}

/**
 * Admin: Export complaints to CSV report
 */
export async function exportComplaintsReport(complaintsList = null) {
  const list = complaintsList || await getAllComplaints();
  if (!list || list.length === 0) {
    throw new Error('No complaints available to export.');
  }

  const headers = [
    'Ticket ID',
    'Title',
    'Category',
    'Priority',
    'Status',
    'Student Name',
    'Student Email',
    'Department',
    'Location',
    'Assigned Faculty',
    'Created Date',
    'Resolved Date',
    'Closed Date',
    'Student Rating',
    'Student Feedback'
  ];

  const escapeCsv = (str) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = list.map(c => [
    escapeCsv(c.ticketId),
    escapeCsv(c.title),
    escapeCsv(c.category),
    escapeCsv(c.urgency || c.priority),
    escapeCsv(c.status),
    escapeCsv(c.studentName),
    escapeCsv(c.studentEmail),
    escapeCsv(c.department),
    escapeCsv(c.location),
    escapeCsv(c.assignedFacultyName || 'Unassigned'),
    escapeCsv(c.createdAt),
    escapeCsv(c.resolvedAt || 'N/A'),
    escapeCsv(c.closedAt || 'N/A'),
    escapeCsv(c.feedback ? c.feedback.rating : 'N/A'),
    escapeCsv(c.feedback ? c.feedback.comment : '')
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CampusCare_Complaints_Report_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { success: true, count: list.length };
}

/**
 * Fetch all student feedback reviews for Admin
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

/* ==========================================================================
   4. REAL-TIME SNAPSHOT LISTENERS
   ========================================================================== */

/**
 * Real-Time Listener: Student Complaints
 */
export function listenToStudentComplaints(studentId, callback) {
  let unsubSnapshot = () => {};
  
  const localHandler = (e) => {
    const list = e.detail || getDemoComplaints();
    callback(list.filter(c => c.studentId === studentId || studentId === 'demo-student-id'));
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('campuscare_complaints_updated', localHandler);
  }

  try {
    const q = query(collection(db, 'complaints'), where('studentId', '==', studentId));
    unsubSnapshot = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      } else {
        const demo = getDemoComplaints().filter(c => c.studentId === studentId || studentId === 'demo-student-id');
        callback(demo);
      }
    }, (err) => {
      console.warn('Student complaints realtime listener fallback:', err.message);
      const demo = getDemoComplaints().filter(c => c.studentId === studentId || studentId === 'demo-student-id');
      callback(demo);
    });
  } catch (err) {
    const demo = getDemoComplaints().filter(c => c.studentId === studentId || studentId === 'demo-student-id');
    callback(demo);
  }

  return () => {
    unsubSnapshot();
    if (typeof window !== 'undefined') {
      window.removeEventListener('campuscare_complaints_updated', localHandler);
    }
  };
}

/**
 * Real-Time Listener: Faculty Assigned Complaints
 */
export function listenToFacultyComplaints(facultyId, callback) {
  let unsubSnapshot = () => {};

  const filterForFaculty = (list) => {
    return list.filter(c => 
      c.assignedFacultyId === facultyId || 
      facultyId === 'demo-faculty-id' ||
      c.assignedFacultyId === 'demo-faculty-id' ||
      (c.assignedFacultyName && c.assignedFacultyName.includes('Jenkins'))
    );
  };

  const localHandler = (e) => {
    const list = e.detail || getDemoComplaints();
    callback(filterForFaculty(list));
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('campuscare_complaints_updated', localHandler);
  }

  try {
    const q = query(collection(db, 'complaints'), where('assignedFacultyId', '==', facultyId));
    unsubSnapshot = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      } else {
        callback(filterForFaculty(getDemoComplaints()));
      }
    }, (err) => {
      console.warn('Faculty complaints realtime listener fallback:', err.message);
      callback(filterForFaculty(getDemoComplaints()));
    });
  } catch (err) {
    callback(filterForFaculty(getDemoComplaints()));
  }

  return () => {
    unsubSnapshot();
    if (typeof window !== 'undefined') {
      window.removeEventListener('campuscare_complaints_updated', localHandler);
    }
  };
}

/**
 * Real-Time Listener: All Master Complaints (Admin)
 */
export function listenToAllComplaints(callback) {
  let unsubSnapshot = () => {};

  const localHandler = (e) => {
    const list = e.detail || getDemoComplaints();
    callback(list);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('campuscare_complaints_updated', localHandler);
  }

  try {
    const q = query(collection(db, 'complaints'));
    unsubSnapshot = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      } else {
        callback(getDemoComplaints());
      }
    }, (err) => {
      console.warn('All complaints realtime listener fallback:', err.message);
      callback(getDemoComplaints());
    });
  } catch (err) {
    callback(getDemoComplaints());
  }

  return () => {
    unsubSnapshot();
    if (typeof window !== 'undefined') {
      window.removeEventListener('campuscare_complaints_updated', localHandler);
    }
  };
}

/**
 * Real-Time Listener: Single Complaint with Timeline Subcollection
 */
export function listenToComplaintDetails(complaintId, callback) {
  let unsubParent = () => {};
  let unsubTimeline = () => {};

  const localHandler = (e) => {
    const list = e.detail || getDemoComplaints();
    const found = list.find(c => c.id === complaintId || c.ticketId === complaintId);
    if (found) callback(found);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('campuscare_complaints_updated', localHandler);
  }

  try {
    const docRef = doc(db, 'complaints', complaintId);
    const timelineRef = collection(db, `complaints/${complaintId}/timeline`);

    let parentData = null;
    let timelineData = [];

    const triggerCallback = () => {
      if (parentData) {
        callback({
          ...parentData,
          timeline: [...timelineData].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        });
      }
    };

    unsubParent = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        parentData = { id: docSnap.id, ...docSnap.data() };
        triggerCallback();
      } else {
        const demoList = getDemoComplaints();
        const found = demoList.find(c => c.id === complaintId || c.ticketId === complaintId);
        callback(found || null);
      }
    }, (err) => {
      console.warn('Complaint parent listener fallback:', err.message);
      const demoList = getDemoComplaints();
      const found = demoList.find(c => c.id === complaintId || c.ticketId === complaintId);
      callback(found || null);
    });

    unsubTimeline = onSnapshot(timelineRef, (timelineSnap) => {
      timelineData = timelineSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      triggerCallback();
    }, (err) => {
      console.warn('Complaint timeline subcollection listener fallback:', err.message);
    });

  } catch (err) {
    const demoList = getDemoComplaints();
    const found = demoList.find(c => c.id === complaintId || c.ticketId === complaintId);
    callback(found || null);
  }

  return () => {
    unsubParent();
    unsubTimeline();
    if (typeof window !== 'undefined') {
      window.removeEventListener('campuscare_complaints_updated', localHandler);
    }
  };
}
