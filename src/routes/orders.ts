import { Router } from "express";
import { z } from "zod";
import * as orderService from "../services/orders.js";
import { extractOrderData } from "../services/aiExtractor.js";
import { handleVagueOrder } from "../services/smartOrder.js";
import { validate, validateParams } from "../utils/validator.js";

const router = Router();

const createOrderSchema = z.object({
  customerId: z.string().uuid(),
  providerId: z.string().uuid(),
  source: z.enum(["WEB", "WHATSAPP", "EMAIL", "PHONE"]),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .optional(),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "CONFIRMED", "PREPARING", "DELIVERED"]),
});

// Smart Order Manager Middleware (with AI Integration)
const smartOrderManager = async (req: any, _res: any, next: any) => {
  try {
    const { customerId, source, items, notes } = req.body;

    if (source === "WHATSAPP") {
      // 1. Try Vague/Repeat Order first
      if (!items || items.length === 0) {
        const suggestedItems = await handleVagueOrder(customerId, notes || null);
        if (suggestedItems) {
          req.body.items = suggestedItems;
        } else if (notes) {
          // 2. If not repeat, try AI Extraction from notes
          const extracted = await extractOrderData(notes);

          // Map extracted item names to product IDs (simple fuzzy match or just for demo)
          // For this hackathon, we'll assume we need to match names to real products
          // To keep it simple, we'll store the AI findings in the request
          req.body.requiresManualIntervention = extracted.requires_manual_intervention;
          req.body.confidenceScore = extracted.confidence_score;
          req.body.extractedLocation = extracted.location;
          req.body.extractedTime = extracted.delivery_time;

          // Note: Full item matching logic would go here.
          // For now, if AI extracted items, we pass them along if they match known products.
          // For the sake of the task, we'll prioritize the AI service's extracted items.
          // (In a real app, you'd fetch all products and find the best UUID matches)
          if (!req.body.items && extracted.items.length > 0) {
            // Placeholder: In a real system, you'd resolve these names to IDs
            // For this demo, we'll flag for manual intervention if we can't auto-resolve
            req.body.requiresManualIntervention = true;
          }
        }
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};

router.post("/", validate(createOrderSchema), smartOrderManager, async (req, res, next) => {
  try {
    // Ensure items exists even if empty, or handle in service
    if (!req.body.items) {
      req.body.items = [];
    }

    const order = await orderService.createOrder(req.body);
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

router.get("/", async (_req, res, next) => {
  try {
    const orders = await orderService.getOrders();
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", validateParams(z.object({ id: z.string().uuid() })), async (req, res, next) => {
  try {
    const order = await orderService.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json(order);
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/:id/status",
  validateParams(z.object({ id: z.string().uuid() })),
  validate(updateStatusSchema),
  async (req, res, next) => {
    try {
      const order = await orderService.updateOrderStatus(req.params.id, req.body.status);
      res.json(order);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/:id/invoice",
  validateParams(z.object({ id: z.string().uuid() })),
  async (req, res, next) => {
    try {
      const order = await orderService.markAsInvoiced(req.params.id);
      res.json(order);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
