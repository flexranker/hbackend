import { Request, Response } from "express";
import twilio from "twilio";
import prisma from "../lib/prisma.js";
import { processConciergeMessage } from "../services/aiConcierge.js";
import * as orderService from "../services/orders.js";
import logger from "../utils/logger.js";

const { MessagingResponse } = twilio.twiml;

export const handleWhatsAppWebhook = async (req: Request, res: Response) => {
  const { Body, From, MediaUrl0 } = req.body;
  const phoneNumber = From.replace("whatsapp:", "");

  try {
    // 1. Fetch User Context
    const customer = await prisma.customer.findFirst({
      where: { phone: { contains: phoneNumber } },
      include: {
        orders: {
          take: 3,
          orderBy: { createdAt: "desc" },
          include: { items: { include: { product: true } } },
        },
        contractPrices: { include: { product: true } },
      },
    });

    let userContext: any = {};
    let dietaryNotes: any[] = [];

    if (customer) {
      // Fetch dietary notes for this customer's orders
      const orderIds = customer.orders.map(o => o.id);
      dietaryNotes = await prisma.dietaryNote.findMany({
        where: { orderId: { in: orderIds } }
      });

      userContext = {
        name: customer.name,
        companyName: customer.companyName,
        orderHistory: customer.orders,
        contractPrices: customer.contractPrices,
        dietaryNotes: dietaryNotes
      };
    }

    // 2. Call AI Concierge
    const aiResponse = await processConciergeMessage(Body, userContext, MediaUrl0);

    const twiml = new MessagingResponse();
    let replyText = aiResponse.friendly_reply;

    // 3. Handle Order Intent
    if (aiResponse.intent === "ORDER" && customer && aiResponse.items.length > 0) {
      const order = await orderService.createOrder({
        customerId: customer.id,
        providerId: "demo-provider-id", // In real app, derived from context
        source: "WHATSAPP",
        status: "DRAFT",
        items: aiResponse.items
          .filter(i => i.productId)
          .map(i => ({
            productId: i.productId as string,
            quantity: i.qty
          }))
      });
      replyText += `\n\n✅ Order Created! ID: ${order.id.slice(0, 8)}`;
    }

    twiml.message(replyText);

    res.type("text/xml").send(twiml.toString());
  } catch (error: any) {
    logger.error({ error: error.message }, "WhatsApp Webhook failed");
    const twiml = new MessagingResponse();
    twiml.message("I'm having a technical glitch. Please try again in a moment.");
    res.type("text/xml").send(twiml.toString());
  }
};
