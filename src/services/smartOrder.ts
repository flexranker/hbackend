import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";

export const getLastSuccessfulOrder = async (customerId: string) => {
  return await prisma.order.findFirst({
    where: {
      customerId,
      status: { in: ["DELIVERED", "CONFIRMED"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        select: {
          productId: true,
          quantity: true,
        },
      },
    },
  });
};

export const getFavoriteOrder = async (customerId: string) => {
  return await prisma.order.findFirst({
    where: {
      customerId,
      isFavorite: true,
    },
    orderBy: { updatedAt: "desc" },
    include: {
      items: {
        select: {
          productId: true,
          quantity: true,
        },
      },
    },
  });
};

export const handleVagueOrder = async (customerId: string, notes: string | null) => {
  const vagueTriggers = ["same as last time", "usual", "repeat last", "same as last"];
  const isVague = notes && vagueTriggers.some((trigger) => notes.toLowerCase().includes(trigger));

  if (isVague) {
    logger.info(`Vague WhatsApp order detected for customer ${customerId}: "${notes}"`);
    const lastOrder = await getLastSuccessfulOrder(customerId);

    if (lastOrder && lastOrder.items.length > 0) {
      logger.info(`Auto-filling order from last successful order ${lastOrder.id}`);
      return lastOrder.items;
    }

    logger.warn(`No recent successful order found for customer ${customerId} to auto-fill.`);
  }

  return null;
};
