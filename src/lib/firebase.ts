
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB_eFCuxKLdzFdESDEpkA3Nx7KUEAAToSk",
  authDomain: "student-teacher-portal-d06cf.firebaseapp.com",
  projectId: "student-teacher-portal-d06cf",
  storageBucket: "student-teacher-portal-d06cf.appspot.com",
  messagingSenderId: "524149800195",
  appId: "1:524149800195:web:92c1eef236b95f799bbd36"
};


// Initialize Firebase
let app;
if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (e) {
    console.error("Firebase initialization error", e);
  }
} else {
  app = getApp();
}

// Ensure app is initialized before exporting auth and db
const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;
const storage = app ? getStorage(app) : null;

export { db, auth, storage, serverTimestamp };
