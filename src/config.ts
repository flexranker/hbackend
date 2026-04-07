export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  firebaseCredentials: process.env.FIREBASE_ADMIN_CREDENTIALS 
    ? JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS)
    : null,
  adminUids: process.env.ADMIN_UIDS ? process.env.ADMIN_UIDS.split(',') : [],
};
