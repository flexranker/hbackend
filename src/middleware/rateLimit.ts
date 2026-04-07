import rateLimit from "express-rate-limit";
import { config } from "../config.js";

// Broad IP-based guard — higher ceiling, protects unauthenticated endpoints
export const ipRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.ipMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this network, please try again later" },
});

// Per-user guard — applied only to authenticated routes
export const userRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.userMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => req.user?.uid ?? req.ip ?? "anonymous",
  message: { error: "Too many requests, please try again later" },
  skip: (req: any) => !req.user, // only apply when user is authenticated
});
