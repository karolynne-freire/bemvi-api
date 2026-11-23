// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDepGK3xFEpVqQueZREnuhdQHD2Ajr83mQ",
  authDomain: "maesatipicas-3c501.firebaseapp.com",
  projectId: "maesatipicas-3c501",
  storageBucket: "maesatipicas-3c501.firebasestorage.app",
  messagingSenderId: "738800105748",
  appId: "1:738800105748:web:806c41027e226f5e97aa01",
  measurementId: "G-4QSL3LZ0LM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);