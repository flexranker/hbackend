import { Router } from "express";
import { z } from "zod";
import * as orderService from "../services/orders.js";
import { validate, validateParams } from "../utils/validator.js";

const router = Router();

const createOrderSchema = z.object({
  customerId: z.string().uuid(),
  source: z.enum(["WEB", "WHATSAPP", "EMAIL", "PHONE"]),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
    }),
  ),
});

const updateStatusSchema = z.object({
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "CONFIRMED", "PREPARING", "DELIVERED"]),
});

router.post("/", validate(createOrderSchema), async (req, res, next) => {
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
