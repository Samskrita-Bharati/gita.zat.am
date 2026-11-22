// Import Firebase from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

import "../../analytics/site-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyDSWtsf3Cj06lZh5f4XX2wiuZtLMxm1IPw",
  authDomain: "gg-zatam.firebaseapp.com",
  projectId: "gg-zatam",
  storageBucket: "gg-zatam.firebasestorage.app",
  messagingSenderId: "577534973660",
  appId: "1:577534973660:web:808367eb6054c735920619",
  measurementId: "G-0GFMCFG25N",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Website measurement is initialized once by analytics/site-analytics.js.
// Firebase Auth/Firestore always remain on gg-zatam regardless of GA4 ID.

export {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
};
