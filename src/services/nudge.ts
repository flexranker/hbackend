import cron from "node-cron";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";

const simulateWhatsAppNudge = async (orderId: string, status: string, customerName: string) => {
  logger.info(`[WhatsApp Nudge] Order ${orderId} (${status}) for ${customerName} has been stuck for > 4h.`);
};

export const initNudgeSystem = () => {
  // Run every hour: "0 * * * *"
  cron.schedule("0 * * * *", async () => {
    logger.info("Running Nudge check for stuck orders...");

    try {
      const fourHoursAgo = new Date();
      fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);

      const stuckOrders = await prisma.order.findMany({
        where: {
          status: { in: ["DRAFT", "PENDING_APPROVAL"] },
          createdAt: { lt: fourHoursAgo },
        },
        include: {
          customer: true,
        },
      });

      if (stuckOrders.length === 0) {
        logger.info("No stuck orders found.");
        return;
      }

      for (const order of stuckOrders) {
        // 1. Trigger CRITICAL_ALERT log in AuditLog
        await prisma.auditLog.create({
          data: {
            level: "CRITICAL_ALERT",
            message: `Order ${order.id} stuck in ${order.status} for over 4 hours.`,
            context: {
              orderId: order.id,
              status: order.status,
              createdAt: order.createdAt,
            },
          },
        });

        // 2. Simulate WhatsApp Nudge
        await simulateWhatsAppNudge(order.id, order.status, order.customer.name);
      }

      logger.info(`Nudge system processed ${stuckOrders.length} orders.`);
    } catch (error: any) {
      logger.error({ error: error.message }, "Error in Nudge system cron job");
    }
  });

  logger.info("Nudge system initialized.");
};
