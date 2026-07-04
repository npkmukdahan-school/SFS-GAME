// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// แทนที่ข้อมูลด้านล่างนี้ด้วย Config ของคุณเองจาก Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyYourApiKeyHere...",
  authDomain: "sfs-game-app.firebaseapp.com",
  projectId: "sfs-game-app",
  storageBucket: "sfs-game-app.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export บริการที่จะนำไปใช้
export const auth = getAuth(app);
export const db = getFirestore(app);
