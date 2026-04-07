import type { NextFunction, Request, Response } from "express";
import { adminService } from "../services/admin.js";
import { ForbiddenError } from "../utils/errors.js";

export const requireAdmin = async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new ForbiddenError("Authentication required"));
  }

  try {
    const adminUids = await adminService.getAdminUids();
    if (!adminUids.includes(req.user.uid)) {
      return next(new ForbiddenError("Admin access required"));
    }
    next();
  } catch (err) {
    next(err);
  }
};
