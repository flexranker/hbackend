import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import type { Order, OrderStatus } from "@prisma/client";
import logger from "../utils/logger.js";

let io: Server;

export const initNotificationService = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*", // Adjust as needed for production
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    socket.on("join-provider", (providerId: string) => {
      socket.join(`provider:${providerId}`);
      logger.info(`Client ${socket.id} joined room provider:${providerId}`);
    });

    socket.on("disconnect", () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const notifyNewOrder = (providerId: string, order: Order) => {
  if (!io) {
    logger.warn("NotificationService not initialized");
    return;
  }
  // Emit to specific provider's room
  io.to(`provider:${providerId}`).emit("NEW_ORDER_RECEIVED", order);
  logger.info(`NEW_ORDER_RECEIVED emitted to provider:${providerId}`);
};

export const notifyStatusUpdate = (providerId: string, orderId: string, status: OrderStatus) => {
  if (!io) {
    logger.warn("NotificationService not initialized");
    return;
  }
  io.to(`provider:${providerId}`).emit("STATUS_UPDATED", { orderId, status });
  logger.info(`STATUS_UPDATED emitted to provider:${providerId} for order ${orderId}`);
};
