import { createServer } from "node:http";
import app from "./app.js";
import { config } from "./config.js";
import { initNotificationService } from "./services/notifications.js";
import { initNudgeSystem } from "./services/nudge.js";
import logger from "./utils/logger.js";

const httpServer = createServer(app);

// Initialize Socket.io via NotificationService
initNotificationService(httpServer);

// Initialize Nudge cron job
initNudgeSystem();

httpServer.listen(config.port, () => {
  logger.info(
    `Server is running in ${config.nodeEnv} mode on port ${config.port}`,
  );
  logger.info(`Frontend URL: ${config.frontendUrl}`);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ promise, reason }, "Unhandled Rejection");
});

process.on("uncaughtException", (error) => {
  logger.error({ error }, "Uncaught Exception");
  process.exit(1);
});
