import { Request, Response } from "express";
import twilio from "twilio";
import prisma from "../lib/prisma.js";
import { processConciergeMessage } from "../services/aiConcierge.js";
import * as orderService from "../services/orders.js";
import logger from "../utils/logger.js";

const { MessagingResponse } = twilio.twiml;

export const handleWhatsAppWebhook = async (req: Request, res: Response) => {
  const { Body, From, MediaUrl0 } = req.body;
  const phoneNumber = From?.replace("whatsapp:", "") || "";

  try {
    // 1. Fetch User Context (Optimized)
    const existingCustomer = await prisma.customer.findFirst({
      where: { phone: { contains: phoneNumber } },
      include: {
        orders: { take: 2, orderBy: { createdAt: "desc" } },
      },
    });

    let userContext: any = {};
    if (existingCustomer) {
      userContext = {
        name: existingCustomer.name,
        companyName: existingCustomer.companyName,
        orderHistory: existingCustomer.orders,
      };
    }

    // 2. Call AI Concierge
    const aiResponse = await processConciergeMessage(Body, userContext, MediaUrl0);

    const twiml = new MessagingResponse();
    let replyText = aiResponse.friendly_reply;

    // 3. Automated Actions (Intent handling)
    
    let finalCustomerId = existingCustomer?.id;
    let finalCustomerName = existingCustomer?.name;

    if (aiResponse.intent === "REGISTRATION" && aiResponse.registrationData) {
      const name = aiResponse.registrationData.name || "New Customer";
      const newCustomer = await prisma.customer.create({
        data: {
          name,
          companyName: aiResponse.registrationData.companyName || "Unknown",
          phone: phoneNumber,
          email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        },
      });
      finalCustomerId = newCustomer.id;
      finalCustomerName = newCustomer.name;
      replyText += `\n\n🎉 Welcome, ${finalCustomerName}!`;
    }

    if (aiResponse.intent === "CANCEL" && aiResponse.targetOrderId) {
      await prisma.order.update({
        where: { id: aiResponse.targetOrderId },
        data: { status: "CANCELLED" },
      });
      replyText += `\n\n🚫 Order ${aiResponse.targetOrderId.slice(0, 8)} cancelled.`;
    }

    if (aiResponse.intent === "ORDER" && finalCustomerId && aiResponse.items.length > 0) {
      const order = await orderService.createOrder({
        customerId: finalCustomerId,
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

      // Handle Dietary Findings if present (Async)
      if (aiResponse.dietaryFindings && aiResponse.dietaryFindings.length > 0) {
        Promise.all(
          aiResponse.dietaryFindings.map((f) =>
            prisma.dietaryNote.create({
              data: {
                orderId: order.id,
                label: f.label,
                details: f.details,
                isCritical: f.isCritical,
              },
            })
          )
        ).catch((err) => logger.error({ err }, "Async dietary save failed"));
      }

      replyText += `\n\n✅ Order Saved! ID: ${order.id.slice(0, 8)}`;
    }

    twiml.message(replyText);
    res.type("text/xml").send(twiml.toString());
  } catch (error: any) {
    logger.error({ error: error.message }, "WhatsApp Webhook failed");
    const twiml = new MessagingResponse();
    twiml.message(`Technical glitch: ${error.message}.`);
    res.type("text/xml").send(twiml.toString());
  }
};
