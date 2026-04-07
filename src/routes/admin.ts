import { type NextFunction, type Request, type Response, Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/admin.js";
import { authenticate } from "../middleware/auth.js";
import { adminService } from "../services/admin.js";
import { validateParams } from "../utils/validator.js";

const router = Router();

const idParamSchema = z.object({
  id: z.string().min(1).max(128),
});

const _banUserSchema = z.object({
  reason: z.string().optional(),
});

const featurePostSchema = z.object({
  action: z.enum(["feature", "unfeature"]),
});

router.post(
  "/users/:id/ban",
  authenticate,
  requireAdmin,
  validateParams(idParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await adminService.banUser(req.params.id, req.body.reason);
      res.json(user);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/users/:id/unban",
  authenticate,
  requireAdmin,
  validateParams(idParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await adminService.unbanUser(req.params.id);
      res.json(user);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/posts/:id/feature",
  authenticate,
  requireAdmin,
  validateParams(idParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { action } = featurePostSchema.parse(req.body);
      const post =
        action === "feature"
          ? await adminService.featurePost(req.params.id)
          : await adminService.unfeaturePost(req.params.id);
      res.json(post);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/stats",
  authenticate,
  requireAdmin,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await adminService.getStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
