import { type NextFunction, type Request, type Response, Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/admin.js";
import { authenticate } from "../middleware/auth.js";
import { adminService } from "../services/admin.js";

const router = Router();

const sendNotificationSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  data: z.record(z.string()).optional(),
});

router.post(
  "/send-all",
  authenticate,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, body, data } = sendNotificationSchema.parse(req.body);
      const result = await adminService.sendNotificationToAll(title, body, data);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
