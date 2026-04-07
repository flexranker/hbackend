import { Router } from "express";
import { z } from "zod";
import * as orderService from "../services/orders.js";
import { extractOrderData } from "../services/aiExtractor.js";
import { scanForDietaryRequirements } from "../services/dietarySafety.js";
import { validate } from "../utils/validator.js";

const router = Router();

const aiIngestSchema = z.object({
  customerId: z.string().uuid(),
  providerId: z.string().uuid(),
  inputType: z.enum(["text", "image", "audio"]),
  inputData: z.string().min(1), // URL, raw text, or base64
});

router.post("/ingest-ai", validate(aiIngestSchema), async (req, res, next) => {
  try {
    const { customerId, providerId, inputType, inputData } = req.body;

    const extracted = await extractOrderData(inputData, inputType);

    const sourceMap: Record<string, any> = {
      text: "WHATSAPP",
      image: "IMAGE",
      audio: "VOICE",
    };

    const order = await orderService.createOrder({
      customerId,
      providerId,
      source: sourceMap[inputType],
      status: "PENDING_REVIEW",
      notes: inputType === "text" ? inputData : `Extracted from ${inputType}`,
      requiresManualIntervention: extracted.requires_manual_intervention,
      confidenceScore: extracted.confidence_score,
      extractedLocation: extracted.location,
      extractedTime: extracted.delivery_time,
      items: extracted.items
        .filter((item: any) => item.productId !== null)
        .map((item: any) => ({
          productId: item.productId as string,
          quantity: item.qty,
        })),
    });

    // Post-processing: Scan for Dietary Requirements (Allergies/Preferences)
    if (inputType === "text") {
      scanForDietaryRequirements(order.id, inputData).catch((err) =>
        console.error(`[Dietary Safety] Scan failed for order ${order.id}:`, err.message),
      );
    }

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

export default router;
