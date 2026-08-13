/* ==========================================================================
   CampusCare - Firebase Diagnostic Connection Test Utility
   ========================================================================== */

import { app, auth, db, storage } from '../config/firebase-config.js';

export async function testFirebaseConnection() {
  console.log('%c🔥 Running Firebase Connection Diagnostic Test...', 'color:#2563eb; font-weight:bold; font-size:1.1rem;');

  const results = {
    appInitialized: false,
    authConnected: false,
    firestoreConnected: false,
    storageConnected: false,
    errors: []
  };

  // 1. Test App Instance
  try {
    if (app && app.name) {
      results.appInitialized = true;
      console.log('✅ 1. Firebase Core App: Connected (Project ID: ' + (app.options.projectId || 'Demo') + ')');
    }
  } catch (err) {
    results.errors.push('App init error: ' + err.message);
    console.error('❌ 1. Firebase Core App: Failed', err);
  }

  // 2. Test Auth Instance
  try {
    if (auth) {
      results.authConnected = true;
      console.log('✅ 2. Firebase Auth Service: Ready (Current User: ' + (auth.currentUser ? auth.currentUser.email : 'None / Signed Out') + ')');
    }
  } catch (err) {
    results.errors.push('Auth error: ' + err.message);
    console.error('❌ 2. Firebase Auth Service: Failed', err);
  }

  // 3. Test Firestore Instance
  try {
    if (db) {
      results.firestoreConnected = true;
      console.log('✅ 3. Cloud Firestore Database: Client Initialized');
    }
  } catch (err) {
    results.errors.push('Firestore error: ' + err.message);
    console.error('❌ 3. Cloud Firestore Database: Failed', err);
  }

  // 4. Test Storage Instance
  try {
    if (storage) {
      results.storageConnected = true;
      console.log('✅ 4. Firebase Storage Service: Client Initialized');
    }
  } catch (err) {
    results.errors.push('Storage error: ' + err.message);
    console.error('❌ 4. Firebase Storage Service: Failed', err);
  }

  return results;
}

// Auto-run test in browser console when loaded
if (typeof window !== 'undefined') {
  window.testFirebaseConnection = testFirebaseConnection;
  testFirebaseConnection();
}
