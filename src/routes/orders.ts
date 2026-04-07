import { Router } from "express";
import { z } from "zod";
import * as orderService from "../services/orders.js";
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

// Smart Order Manager Middleware
const smartOrderManager = async (req: any, _res: any, next: any) => {
  try {
    const { customerId, source, items, notes } = req.body;

    // Intercept vague WhatsApp orders
    if (source === "WHATSAPP" && (!items || items.length === 0)) {
      const suggestedItems = await handleVagueOrder(customerId, notes || null);
      if (suggestedItems) {
        req.body.items = suggestedItems;
      } else {
        return _res.status(400).json({ 
          error: "Vague order detected but no previous history found to auto-fill items." 
        });
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};

router.post("/", validate(createOrderSchema), smartOrderManager, async (req, res, next) => {
  try {
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
