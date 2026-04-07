import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import * as orderService from "../services/orders.js";
import { extractOrderData } from "../services/aiExtractor.js";
import { handleVagueOrder } from "../services/smartOrder.js";
import { logCorrection } from "../services/correctionLedger.js";
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
  status: z.enum([
    "DRAFT",
    "PENDING_REVIEW",
    "PENDING_APPROVAL",
    "CONFIRMED",
    "PREPARING",
    "DELIVERED",
  ]),
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

          req.body.requiresManualIntervention = extracted.requires_manual_intervention;
          req.body.confidenceScore = extracted.confidence_score;
          req.body.extractedLocation = extracted.location;
          req.body.extractedTime = extracted.delivery_time;

          // Map AI extracted items to real product IDs where possible
          if (!req.body.items && extracted.items.length > 0) {
            req.body.items = extracted.items
              .filter((item: any) => item.productId !== null)
              .map((item: any) => ({
                productId: item.productId,
                quantity: item.qty,
              }));

            // If any item was unrecognized or needs confirmation, ensure manual intervention is flagged
            const hasUncertainItems = extracted.items.some(
              (item: any) => item.status === "UNRECOGNIZED" || item.status === "NEEDS_CONFIRMATION",
            );
            if (hasUncertainItems) {
              req.body.requiresManualIntervention = true;
            }
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
  "/:id/review",
  validateParams(z.object({ id: z.string().uuid() })),
  async (req, res, next) => {
    try {
      const orderId = req.params.id;
      const originalOrder = await orderService.getOrder(orderId);

      if (!originalOrder) {
        return res.status(404).json({ error: "Order not found" });
      }

      if (originalOrder.status !== "PENDING_REVIEW") {
        return res.status(400).json({ error: "Order is not in PENDING_REVIEW status" });
      }

      // Log correction before updating
      await logCorrection(orderId, originalOrder, req.body);

      // Simple update: In real app, you'd handle item updates carefully
      const { items, ...orderData } = req.body;

      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          ...orderData,
          status: "PENDING_APPROVAL",
        },
      });

      res.json(updatedOrder);
    } catch (error) {
      next(error);
    }
  },
);

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
