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
    const existingCustomer = await prisma.customer.findFirst({
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

    if (existingCustomer) {
      const orderIds = existingCustomer.orders.map((o) => o.id);
      dietaryNotes = await prisma.dietaryNote.findMany({
        where: { orderId: { in: orderIds } },
      });

      userContext = {
        name: existingCustomer.name,
        companyName: existingCustomer.companyName,
        orderHistory: existingCustomer.orders,
        contractPrices: existingCustomer.contractPrices,
        dietaryNotes: dietaryNotes,
      };
    }

    // 2. Call AI Concierge
    const aiResponse = await processConciergeMessage(Body, userContext, MediaUrl0);

    const twiml = new MessagingResponse();
    let replyText = aiResponse.friendly_reply;

    // 3. Automated Actions based on Intent
    
    let finalCustomer = existingCustomer;

    // A. Handle Registration
    if (aiResponse.intent === "REGISTRATION" && aiResponse.registrationData) {
      const name = aiResponse.registrationData.name || "New Customer";
      const companyName = aiResponse.registrationData.companyName || "Unknown Company";
      
      const newCustomer = await prisma.customer.create({
        data: {
          name,
          companyName,
          phone: phoneNumber,
          email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        },
      });
      // @ts-ignore - simple mapping for the finalCustomer
      finalCustomer = newCustomer;
      replyText += `\n\n🎉 Welcome to Snap Order, ${newCustomer.name}! You are now registered under ${newCustomer.companyName}.`;
    }

    // B. Handle Order Cancellation
    if (aiResponse.intent === "CANCEL" && aiResponse.targetOrderId) {
      await prisma.order.update({
        where: { id: aiResponse.targetOrderId },
        data: { status: "CANCELLED" },
      });
      replyText += `\n\n🚫 Order ${aiResponse.targetOrderId.slice(0, 8)} has been cancelled.`;
    }

    // C. Handle Order Creation
    if (aiResponse.intent === "ORDER" && finalCustomer && aiResponse.items.length > 0) {
      const order = await orderService.createOrder({
        customerId: finalCustomer.id,
        providerId: "demo-provider-id",
        source: "WHATSAPP",
        status: "DRAFT",
        items: aiResponse.items
          .filter((i) => i.productId)
          .map((i) => ({
            productId: i.productId as string,
            quantity: i.qty,
          })),
      });
      replyText += `\n\n✅ Order Created! ID: ${order.id.slice(0, 8)}`;
    }

    twiml.message(replyText);
    res.type("text/xml").send(twiml.toString());
  } catch (error: any) {
    logger.error({ error: error.message }, "WhatsApp Webhook failed");
    const twiml = new MessagingResponse();
    twiml.message(`I'm having a technical glitch: ${error.message}. Please try again in a moment.`);
    res.type("text/xml").send(twiml.toString());
  }
};
