import { Router } from "express";
import { z } from "zod";
import {
  calculateExpectedUsage,
  submitWastageReport,
  analyzeWastageTrends,
} from "../services/predictivePrep.js";
import { validate, validateParams } from "../utils/validator.js";

const router = Router();

const wastageSchema = z.object({
  chefId: z.string().min(1),
  usages: z.array(
    z.object({
      ingredientId: z.string().uuid(),
      actualQty: z.number().nonnegative(),
    })
  ),
});

router.get("/:orderId/prediction", validateParams(z.object({ orderId: z.string().uuid() })), async (req, res, next) => {
  try {
    const prediction = await calculateExpectedUsage(req.params.orderId);
    res.json(prediction);
  } catch (error) {
    next(error);
  }
});

router.post("/:orderId/wastage", validateParams(z.object({ orderId: z.string().uuid() })), validate(wastageSchema), async (req, res, next) => {
  try {
    const { chefId, usages } = req.body;
    const reports = await submitWastageReport(req.params.orderId, chefId, usages);
    res.status(201).json(reports);
  } catch (error) {
    next(error);
  }
});

router.get("/analytics/wastage-trends", async (_req, res, next) => {
  try {
    const analysis = await analyzeWastageTrends();
    res.json({ analysis });
  } catch (error) {
    next(error);
  }
});

export default router;
