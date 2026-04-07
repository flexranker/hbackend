import type { OrderSource, OrderStatus } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { getEffectivePrice } from "./financialIntegrity.js";
import { notifyNewOrder, notifyStatusUpdate } from "./notifications.js";
import { convertToInvoice, createEstimate } from "./zoho.js";

export interface CreateOrderItem {
  productId: string;
  quantity: number;
}

export interface CreateOrderData {
  customerId: string;
  providerId: string;
  source: OrderSource;
  status?: OrderStatus;
  items: CreateOrderItem[];
  notes?: string;
  requiresManualIntervention?: boolean;
  confidenceScore?: number;
  extractedLocation?: string | null;
  extractedTime?: string | null;
}

export const createOrder = async (data: CreateOrderData) => {
  const {
    customerId,
    providerId,
    source,
    status,
    items,
    notes,
    requiresManualIntervention,
    confidenceScore,
    extractedLocation,
    extractedTime,
  } = data;

  let totalAmount = 0;
  const orderItemsData = await Promise.all(
    items.map(async (item) => {
      const price = await getEffectivePrice(customerId, item.productId);
      const linePrice = Number(price) * item.quantity;
      totalAmount += linePrice;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: price,
      };
    }),
  );

  const order = await prisma.order.create({
    data: {
      customerId,
      providerId,
      source,
      notes,
      requiresManualIntervention: requiresManualIntervention || false,
      confidenceScore: confidenceScore || 1.0,
      extractedLocation,
      extractedTime,
      totalAmount,
      status: status || "DRAFT",
      isInvoiced: false,
      items: {
        create: orderItemsData,
      },
    },
    include: {
      items: true,
      customer: true,
    },
  });

  // Notify via socket
  notifyNewOrder(providerId, order);

  return order;
};

export const getOrder = async (id: string) => {
  return await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: true,
        },
      },
      customer: true,
    },
  });
};

export const getOrders = async () => {
  return await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  });
};

export const updateOrderStatus = async (id: string, status: OrderStatus) => {
  const order = await prisma.order.update({
    where: { id },
    data: { status },
  });

  // Notify status update
  notifyStatusUpdate(order.providerId, order.id, status);

  // Zoho Integration Triggers
  if (status === "PENDING_APPROVAL") {
    createEstimate(id).catch((err) =>
      console.error(`[Zoho] Failed to create estimate for order ${id}:`, err.message),
    );
  } else if (status === "DELIVERED") {
    convertToInvoice(id).catch((err) =>
      console.error(`[Zoho] Failed to convert estimate to invoice for order ${id}:`, err.message),
    );
  }

  return order;
};

export const markAsInvoiced = async (id: string) => {
  return await prisma.order.update({
    where: { id },
    data: { isInvoiced: true },
  });
};

/**
 * Kitchen Log: Mark item as cooked
 */
export const updateCookedQuantity = async (orderItemId: string, cookedQty: number) => {
  return await prisma.orderItem.update({
    where: { id: orderItemId },
    data: { cookedQuantity: cookedQty },
  });
};
