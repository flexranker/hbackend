import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface FirebaseConfig {
  project_id?: string;
  private_key?: string;
  client_email?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadFirebaseConfig(): FirebaseConfig {
  try {
    const configPath = join(__dirname, "..", "fireconfig.json");
    const fileContents = readFileSync(configPath, "utf8");
    return JSON.parse(fileContents);
  } catch {
    return {};
  }
}

const firebaseConfig = loadFirebaseConfig();

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  nodeEnv: process.env.NODE_ENV || "development",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  firebase: {
    projectId: firebaseConfig.project_id || process.env.FIREBASE_PROJECT_ID || "",
    privateKey: (firebaseConfig.private_key || process.env.FIREBASE_PRIVATE_KEY || "").replace(
      /\\n/g,
      "\n",
    ),
    clientEmail: firebaseConfig.client_email || process.env.FIREBASE_CLIENT_EMAIL || "",
  },
  adminUids: process.env.ADMIN_UIDS
    ? process.env.ADMIN_UIDS.split(",")
        .map((uid) => uid.trim())
        .filter(Boolean)
    : [],
};

if (config.adminUids.length === 0) {
  console.warn(
    "[config] WARNING: No ADMIN_UIDS configured. All admin endpoints will return 403. " +
      "Set ADMIN_UIDS=<your-firebase-uid> in .env",
  );
}
