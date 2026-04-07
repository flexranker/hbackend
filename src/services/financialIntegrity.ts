import cron from "node-cron";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import type { Server } from "socket.io";

let io: Server;

export const initFinancialIntegrityService = (socketIo?: Server) => {
  if (socketIo) io = socketIo;

  // Schedule daily reconciliation at midnight: "0 0 * * *"
  cron.schedule("0 0 * * *", async () => {
    logger.info("Running daily revenue reconciliation...");
    await performReconciliation();
  });

  logger.info("FinancialIntegrityService initialized.");
};

export const getEffectivePrice = async (customerId: string, productId: string) => {
  // 1. Check for Contract Price
  const contractPrice = await prisma.contractPrice.findUnique({
    where: {
      customerId_productId: { customerId, productId },
    },
  });

  if (contractPrice) {
    return contractPrice.price;
  }

  // 2. Fallback to Global Product Price
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { price: true },
  });

  if (!product) throw new Error(`Product ${productId} not found`);

  return product.price;
};

export const performReconciliation = async () => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch all products to aggregate counts
    const products = await prisma.product.findMany({
      select: { id: true, name: true },
    });

    for (const product of products) {
      // Sum Invoiced Quantity for yesterday
      const invoicedResult = await prisma.orderItem.aggregate({
        where: {
          productId: product.id,
          order: {
            isInvoiced: true,
            createdAt: {
              gte: yesterday,
              lt: today,
            },
          },
        },
        _sum: { quantity: true },
      });

      // Sum Cooked Quantity for yesterday (from kitchen logs/OrderItem field)
      const cookedResult = await prisma.orderItem.aggregate({
        where: {
          productId: product.id,
          order: {
            createdAt: {
              gte: yesterday,
              lt: today,
            },
          },
        },
        _sum: { cookedQuantity: true },
      });

      const expectedQty = invoicedResult._sum.quantity || 0;
      const actualQty = cookedResult._sum.cookedQuantity || 0;
      const discrepancy = actualQty - expectedQty;

      if (discrepancy > 0) {
        logger.warn(
          `Revenue Leakage detected for ${product.name}: ${discrepancy} units discrepancy.`,
        );

        // 1. Create RevenueLeakage record
        await prisma.revenueLeakage.create({
          data: {
            date: yesterday,
            productId: product.id,
            productName: product.name,
            expectedQty,
            actualQty,
            discrepancy,
          },
        });

        // 2. Emit LEAKAGE_ALERT via Socket.io
        if (io) {
          io.emit("LEAKAGE_ALERT", {
            productName: product.name,
            discrepancy,
            date: yesterday.toISOString().split("T")[0],
          });
        }
      }
    }

    logger.info("Daily reconciliation completed.");
  } catch (error: any) {
    logger.error({ error: error.message }, "Error during reconciliation job");
  }
};
