/* ==========================================================================
   CampusCare - Analytics Data Aggregation & Realtime Firestore Service
   ========================================================================== */

import { db, collection, onSnapshot } from '../config/firebase-config.js';
import { getAllComplaints } from './complaint.service.js';

/**
 * Process complaints list into comprehensive 3-role analytics dataset
 */
export function processAnalyticsData(complaints) {
  const total = complaints.length;
  const submitted = complaints.filter(c => c.status === 'Submitted').length;
  const assigned = complaints.filter(c => c.status === 'Assigned').length;
  const accepted = complaints.filter(c => c.status === 'Accepted').length;
  const inProgress = complaints.filter(c => c.status === 'In Progress' || c.status === 'Accepted').length;
  const resolved = complaints.filter(c => c.status === 'Resolved').length;
  const closed = complaints.filter(c => c.status === 'Closed').length;
  const rejected = complaints.filter(c => c.status === 'Rejected').length;
  const reopened = complaints.filter(c => c.status === 'Reopened').length;

  // High/Critical Priority Counter
  const highCritical = complaints.filter(c => {
    const p = (c.priority || c.urgency || '').toLowerCase();
    return p === 'high' || p === 'critical' || p === 'urgent';
  }).length;

  // Pending Faculty Action (Assigned, Accepted, In Progress, Reopened)
  const pendingFacultyAction = complaints.filter(c => 
    c.status === 'Assigned' || c.status === 'Accepted' || c.status === 'In Progress' || c.status === 'Reopened'
  ).length;

  // 1. Complaints by Category
  const categoriesMap = {};
  complaints.forEach(c => {
    const cat = c.category || 'General';
    categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;
  });

  // 2. Department Distribution
  const departmentMap = {};
  complaints.forEach(c => {
    const dept = c.department || 'General Science';
    departmentMap[dept] = (departmentMap[dept] || 0) + 1;
  });

  // 3. Priority / Urgency Distribution (Low, Medium, High, Critical)
  const priorityMap = { 'Low': 0, 'Medium': 0, 'High': 0, 'Critical': 0 };
  complaints.forEach(c => {
    let p = c.priority || c.urgency || 'Medium';
    if (p === 'Urgent') p = 'Critical';
    priorityMap[p] = (priorityMap[p] || 0) + 1;
  });

  // 4. Status Distribution
  const statusMap = {
    'Submitted': 0,
    'Assigned': 0,
    'Accepted': 0,
    'In Progress': 0,
    'Resolved': 0,
    'Closed': 0,
    'Rejected': 0,
    'Reopened': 0
  };
  complaints.forEach(c => {
    const st = c.status || 'Submitted';
    statusMap[st] = (statusMap[st] || 0) + 1;
  });

  // 5. Faculty Workload (Active complaints assigned per faculty member)
  const facultyWorkloadMap = {};
  complaints.forEach(c => {
    if (c.assignedFacultyName && c.assignedFacultyName !== 'Unassigned') {
      const fName = c.assignedFacultyName;
      facultyWorkloadMap[fName] = (facultyWorkloadMap[fName] || 0) + 1;
    }
  });

  // 6. Monthly Trend
  const monthlyMap = {
    Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0,
    Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0
  };
  complaints.forEach(c => {
    if (c.createdAt) {
      const date = c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
      const monthName = date.toLocaleString('en-US', { month: 'short' });
      if (monthlyMap[monthName] !== undefined) {
        monthlyMap[monthName] += 1;
      }
    }
  });

  // 7. Resolution Statistics
  const resolvedTotal = resolved + closed;
  const resolutionRate = total > 0 ? Math.round((resolvedTotal / total) * 100) : 0;

  return {
    total,
    submitted,
    assigned,
    accepted,
    inProgress,
    resolved,
    closed,
    rejected,
    reopened,
    highCritical,
    pendingFacultyAction,
    categoriesMap,
    departmentMap,
    priorityMap,
    statusMap,
    facultyWorkloadMap,
    monthlyMap,
    resolutionStats: {
      resolvedTotal,
      resolutionRate
    },
    urgencyMap: priorityMap, // Backward compatibility alias
    recentComplaints: complaints.slice(0, 5)
  };
}

/**
 * Fetch static dashboard metrics
 */
export async function getDashboardMetrics() {
  const complaints = await getAllComplaints();
  return processAnalyticsData(complaints);
}

export async function getCategoryAnalytics() {
  const metrics = await getDashboardMetrics();
  return metrics.categoriesMap;
}

export async function getDepartmentAnalytics() {
  const metrics = await getDashboardMetrics();
  return metrics.departmentMap;
}

export async function getPriorityAnalytics() {
  const metrics = await getDashboardMetrics();
  return metrics.priorityMap;
}

export async function getResolutionAnalytics() {
  const metrics = await getDashboardMetrics();
  return metrics.resolutionStats;
}

export async function getFacultyWorkload() {
  const metrics = await getDashboardMetrics();
  return metrics.facultyWorkloadMap;
}

/**
 * Realtime Firestore Snapshot Listener for Analytics Charts
 */
export function subscribeToAnalytics(callback) {
  try {
    const colRef = collection(db, 'complaints');
    return onSnapshot(colRef, (snapshot) => {
      const complaints = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const metrics = processAnalyticsData(complaints);
      callback(metrics);
    }, (err) => {
      console.warn('Realtime snapshot listener error (falling back to static fetch):', err.message);
      getAllComplaints().then(list => callback(processAnalyticsData(list)));
    });
  } catch (e) {
    getAllComplaints().then(list => callback(processAnalyticsData(list)));
  }
}
