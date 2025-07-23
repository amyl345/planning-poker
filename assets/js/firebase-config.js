/**
 * Firebase Configuration for Planning Poker App
 * Initializes Firebase app and database connection
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, connectDatabaseEmulator } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Firebase configuration from your project
const firebaseConfig = {
    apiKey: "AIzaSyAqsvXDflGwqJ-KcKsN60LE2pGV1TUQ0uo",
    authDomain: "planning-poker-app-ad13f.firebaseapp.com",
    databaseURL: "https://planning-poker-app-ad13f-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "planning-poker-app-ad13f",
    storageBucket: "planning-poker-app-ad13f.firebasestorage.app",
    messagingSenderId: "521168568099",
    appId: "1:521168568099:web:c3602323337da47438d696",
    measurementId: "G-98D7K4JXKT"
};

// Initialize Firebase
console.log('Initializing Firebase...');
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database
const database = getDatabase(app);

// Optional: Connect to emulator for local development
// Uncomment the line below if you want to use Firebase emulator for testing
// connectDatabaseEmulator(database, 'localhost', 9000);

console.log('Firebase initialized successfully');

// Export for use in other modules
export { app, database };

// Make available globally for non-module scripts (if needed)
window.firebaseApp = app;
window.firebaseDatabase = database;