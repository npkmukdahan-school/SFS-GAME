// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// แทนที่ข้อมูลด้านล่างนี้ด้วย Config ของคุณเองจาก Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyDdjG3lKL7T_tAd8FOupQhOI7KePTz_6sk",
  authDomain: "sfs-game.firebaseapp.com",
  projectId: "sfs-game",
  storageBucket: "sfs-game.firebasestorage.app",
  messagingSenderId: "644916864534",
  appId: "1:644916864534:web:b1f4d35ab058f5b93c7737",
  measurementId: "G-69BF3T9C6W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export บริการที่จะนำไปใช้
export const auth = getAuth(app);
export const db = getFirestore(app);
