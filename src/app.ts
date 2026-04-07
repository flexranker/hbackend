import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { ipRateLimiter } from "./middleware/rateLimit.js";
import adminRouter from "./routes/admin.js";
import customersRouter from "./routes/customers.js";
import notificationsRouter from "./routes/notifications.js";
import ordersRouter from "./routes/orders.js";
import postsRouter from "./routes/posts.js";
import productsRouter from "./routes/products.js";
import uploadsRouter from "./routes/uploads.js";
import usersRouter from "./routes/users.js";
import prisma from "./lib/prisma.js";
import { AppError } from "./utils/errors.js";
import logger from "./utils/logger.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.frontendUrl }));
  app.use(express.json({ limit: "50mb" }));
  app.use(ipRateLimiter);

  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.info({ method: req.method, path: req.path });
    next();
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.use("/api/users", usersRouter);
  app.use("/api/posts", postsRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/products", productsRouter);

  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      if (err.statusCode >= 500) {
        logger.error({ err, path: req.path });
      } else {
        logger.warn({ err, path: req.path, statusCode: err.statusCode });
      }
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }

    const errorId = randomUUID();

    logger.error({
      errorId,
      err,
      path: req.path,
      method: req.method,
      userId: req.user?.uid ?? null,
    });

    // Log 500 errors to AuditLog table
    prisma.auditLog
      .create({
        data: {
          level: "ERROR",
          message: err.message || "Internal server error",
          stack: err.stack,
          context: {
            errorId,
            path: req.path,
            method: req.method,
            userId: req.user?.uid ?? null,
          },
        },
      })
      .catch((auditErr) => {
        logger.error({ auditErr }, "Failed to create AuditLog entry");
      });

    if (config.nodeEnv === "development") {
      return res.status(500).json({
        error: "Internal server error",
        errorId,
        detail: err.message,
        stack: err.stack,
      });
    }

    return res.status(500).json({
      error: "Internal server error",
      errorId,
    });
  });

  return app;
}

export default createApp();
