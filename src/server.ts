import { createServer } from "node:http";
import app from "./app.js";
import { config } from "./config.js";
import { initNotificationService } from "./services/notifications.js";
import { initNudgeSystem } from "./services/nudge.js";
import { initFinancialIntegrityService } from "./services/financialIntegrity.js";
import { initDietarySafetyService } from "./services/dietarySafety.js";
import { initPromptOptimizer } from "./services/promptOptimizer.js";
import logger from "./utils/logger.js";

const httpServer = createServer(app);

// Initialize Socket.io via NotificationService
const io = initNotificationService(httpServer);

// Initialize Nudge cron job
initNudgeSystem();

// Initialize Financial Integrity Service
initFinancialIntegrityService(io);

// Initialize Dietary Safety Service
initDietarySafetyService(io);

// Initialize Prompt Optimizer (Self-Improving Loop)
initPromptOptimizer();

httpServer.listen(config.port, () => {
  logger.info(`Server is running in ${config.nodeEnv} mode on port ${config.port}`);
  logger.info(`Frontend URL: ${config.frontendUrl}`);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ promise, reason }, "Unhandled Rejection");
});

process.on("uncaughtException", (error) => {
  logger.error({ error }, "Uncaught Exception");
  process.exit(1);
});
