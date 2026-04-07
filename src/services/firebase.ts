import { initializeApp, cert, App, getApps } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { config } from '../config.js';

let app: App;
let auth: Auth;
let db: Firestore;

export function initFirebase() {
  if (config.nodeEnv === 'development') {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  }

  if (getApps().length === 0) {
    if (config.firebaseCredentials) {
      app = initializeApp({
        credential: cert(config.firebaseCredentials),
      });
    } else {
      app = initializeApp();
    }
  } else {
    app = getApps()[0];
  }

  auth = getAuth(app);
  db = getFirestore(app);

  return { app, auth, db };
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    initFirebase();
  }
  return auth;
}

export function getFirestoreDb(): Firestore {
  if (!db) {
    initFirebase();
  }
  return db;
}

export { app, auth, db };
