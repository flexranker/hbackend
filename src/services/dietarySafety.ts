import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import type { Server } from "socket.io";

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: `
    You are a Dietary Safety Officer.
    Analyze the provided text for:
    1. Allergies (e.g., nuts, dairy, gluten, shellfish, soy).
    2. Specific dietary preferences (e.g., vegan, keto, halal, kosher, vegetarian).
    
    Return a strictly formatted JSON object:
    {
      "findings": [
        { "label": "ALLERGY: PEANUTS", "details": "Customer mentioned severe peanut allergy", "isCritical": true },
        { "label": "PREFERENCE: VEGAN", "details": "No animal products", "isCritical": false }
      ]
    }
    If nothing is found, return an empty findings array.
  `,
});

let io: Server;

export const initDietarySafetyService = (socketIo: Server) => {
  io = socketIo;
};

export const scanForDietaryRequirements = async (orderId: string, rawText: string) => {
  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: rawText }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const response = JSON.parse(result.response.text());
    const findings = response.findings || [];

    if (findings.length === 0) return;

    // 1. Create records in DB
    const createdNotes = await Promise.all(
      findings.map((finding: any) =>
        prisma.dietaryNote.create({
          data: {
            orderId,
            label: finding.label,
            details: finding.details,
            isCritical: finding.isCritical ?? true,
          },
        }),
      ),
    );

    // 2. Trigger ALERT_DIETARY via Socket.io if any are critical
    const criticalFindings = findings.filter((f: any) => f.isCritical);
    if (criticalFindings.length > 0 && io) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { providerId: true },
      });

      if (order) {
        io.to(`provider:${order.providerId}`).emit("ALERT_DIETARY", {
          orderId,
          findings: criticalFindings,
        });
        logger.info(`ALERT_DIETARY emitted for order ${orderId}`);
      }
    }

    return createdNotes;
  } catch (error: any) {
    logger.error({ error: error.message }, "Dietary Safety scan failed");
  }
};
