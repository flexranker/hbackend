import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { ForbiddenError } from "../utils/errors.js";

export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new ForbiddenError("Authentication required"));
  }

  if (!config.adminUids.includes(req.user.uid)) {
    return next(new ForbiddenError("Admin access required"));
  }

  next();
};
