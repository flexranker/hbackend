import { Router } from "express";
import { getAiAccuracyStats } from "../services/correctionLedger.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";

const router = Router();

router.get("/ai-accuracy", authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const stats = await getAiAccuracyStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;
