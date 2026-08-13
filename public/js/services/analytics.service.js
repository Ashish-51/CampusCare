/* ==========================================================================
   CampusCare - Analytics Data Aggregation & Realtime Firestore Service
   ========================================================================== */

import { db, collection, onSnapshot } from '../config/firebase-config.js';
import { getAllComplaints } from './complaint.service.js';

/**
 * Process complaints list into chart dataset metrics
 */
export function processAnalyticsData(complaints) {
  const total = complaints.length;
  const submitted = complaints.filter(c => c.status === 'Submitted').length;
  const inProgress = complaints.filter(c => c.status === 'In Progress' || c.status === 'Assigned' || c.status === 'Under Review').length;
  const resolved = complaints.filter(c => c.status === 'Resolved' || c.status === 'Closed').length;
  const rejected = complaints.filter(c => c.status === 'Rejected').length;

  // 1. Complaints by Category
  const categoriesMap = {};
  complaints.forEach(c => {
    const cat = c.category || 'General';
    categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;
  });

  // 2. Monthly Complaints Trend
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

  // 3. Status Distribution
  const statusMap = {
    'Submitted': 0,
    'Under Review': 0,
    'Assigned': 0,
    'In Progress': 0,
    'Resolved': 0,
    'Closed': 0,
    'Rejected': 0
  };
  complaints.forEach(c => {
    const st = c.status || 'Submitted';
    statusMap[st] = (statusMap[st] || 0) + 1;
  });

  // 4. Priority / Urgency Distribution
  const urgencyMap = { Low: 0, Medium: 0, High: 0, Urgent: 0 };
  complaints.forEach(c => {
    const urg = c.urgency || 'Medium';
    urgencyMap[urg] = (urgencyMap[urg] || 0) + 1;
  });

  return {
    total,
    submitted,
    inProgress,
    resolved,
    rejected,
    categoriesMap,
    monthlyMap,
    statusMap,
    urgencyMap,
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
