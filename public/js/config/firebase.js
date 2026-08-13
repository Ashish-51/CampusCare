/* ==========================================================================
   CampusCare - Live Firebase Credentials Configuration (v10+ Modular SDK)
   ========================================================================== */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updatePassword,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  onSnapshot, 
  serverTimestamp,
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { 
  getStorage, 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

// Live Firebase Configuration for CampusCare Project (campuscare-6c227)
const firebaseConfig = window.FIREBASE_CONFIG || {
  apiKey: "AIzaSyDTuWubO5l-N3UsTvT1blorNJyR408lTig",
  authDomain: "campuscare-6c227.firebaseapp.com",
  projectId: "campuscare-6c227",
  storageBucket: "campuscare-6c227.firebasestorage.app",
  messagingSenderId: "565494515070",
  appId: "1:565494515070:web:1eaf726f4fbf4447b19f2f",
  measurementId: "G-WCJGXBPN5N"
};

// Initialize Core Firebase Application
const app = initializeApp(firebaseConfig);

// Initialize Firebase Services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export {
  app,
  auth,
  db,
  storage,
  // Auth Functions
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  sendPasswordResetEmail,
  // Firestore Functions
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  // Storage Functions
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
};
