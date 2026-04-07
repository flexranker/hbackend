import { type App, cert, getApps, initializeApp } from "firebase-admin/app";
import { type Auth, getAuth } from "firebase-admin/auth";
import { type Firestore, getFirestore } from "firebase-admin/firestore";
import { config } from "../config.js";

let app: App;
let auth: Auth;
let db: Firestore;

export function initFirebase() {
  if (config.nodeEnv === "development") {
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  }

  if (getApps().length === 0) {
    const { projectId, privateKey, clientEmail } = config.firebase;

    if (projectId && privateKey && clientEmail) {
      app = initializeApp({
        credential: cert({
          projectId,
          privateKey,
          clientEmail,
        }),
        projectId,
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

export function getFirebaseAdmin(): App {
  if (!app) {
    initFirebase();
  }
  return app;
}

export { app, auth, db };
