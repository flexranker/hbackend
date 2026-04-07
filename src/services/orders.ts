import type { OrderSource, OrderStatus } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { notifyNewOrder, notifyStatusUpdate } from "./notifications.js";
import { createEstimate, convertToInvoice } from "./zoho.js";

export interface CreateOrderItem {
  productId: string;
  quantity: number;
}

export interface CreateOrderData {
  customerId: string;
  providerId: string;
  source: OrderSource;
  items: CreateOrderItem[];
  notes?: string;
}

export const createOrder = async (data: CreateOrderData) => {
  const { customerId, providerId, source, items, notes } = data;

  // Calculate total amount (fetching prices from DB for security)
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });

  const productPriceMap = new Map(products.map((p) => [p.id, p.price]));

  let totalAmount = 0;
  const orderItemsData = items.map((item) => {
    const price = productPriceMap.get(item.productId);
    if (!price) throw new Error(`Product ${item.productId} not found`);
    const linePrice = Number(price) * item.quantity;
    totalAmount += linePrice;
    return {
      productId: item.productId,
      quantity: item.quantity,
      price: price,
    };
  });

  const order = await prisma.order.create({
    data: {
      customerId,
      providerId,
      source,
      notes,
      totalAmount,
      status: "DRAFT",
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
