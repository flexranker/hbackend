import 'dotenv/config';
import { createApp } from './app.js';
import { config } from './config.js';
import { initFirebase } from './services/firebase.js';
import logger from './utils/logger.js';

initFirebase();

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
