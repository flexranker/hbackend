import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";
import logger from "../utils/logger.js";
import { resolveProduct, type ResolvedProduct } from "../utils/productResolver.js";

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: `
    You are an AI order extractor for a corporate catering system.
    Extract the following information from the provided text and return it as a strictly formatted JSON object.
    
    Fields:
    - items: array of objects with 'name' and 'qty' (number)
    - delivery_time: string or null if not mentioned
    - location: string or null if not mentioned

    Rules:
    - If a quantity is not explicitly mentioned but the item is, assume 1.
    - If the text is "Same as last time" or similar, return empty items array.
    - Only include items that are clearly food or beverage products.
  `,
});

export interface AIExtractedItem extends ResolvedProduct {
  qty: number;
}

export interface AIExtractedOrder {
  items: AIExtractedItem[];
  delivery_time: string | null;
  location: string | null;
  requires_manual_intervention: boolean;
  confidence_score: number;
}

export const extractOrderData = async (rawText: string): Promise<AIExtractedOrder> => {
  try {
    const prompt = `Extract order from this text: "${rawText}"`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const response = result.response;
    const text = response.text();
    const parsed = JSON.parse(text);

    // Confidence Score and Manual Intervention logic
    let requires_manual_intervention = false;
    let confidence_score = 1.0;

    const extractedItems: { name: string; qty: number }[] = parsed.items || [];
    const resolvedItems: AIExtractedItem[] = [];

    for (const item of extractedItems) {
      const resolved = await resolveProduct(item.name);
      resolvedItems.push({
        ...resolved,
        qty: item.qty,
      });

      if (resolved.status === "UNRECOGNIZED") {
        requires_manual_intervention = true;
        confidence_score -= 0.2;
      } else if (resolved.status === "NEEDS_CONFIRMATION") {
        requires_manual_intervention = true;
        confidence_score -= 0.1;
      }
    }

    if (extractedItems.length === 0) {
      // If items are missing, check if it's a "Same as last time" request
      const vagueTriggers = ["same", "usual", "repeat", "last time"];
      const isVague = vagueTriggers.some((t) => rawText.toLowerCase().includes(t));

      if (!isVague) {
        requires_manual_intervention = true;
        confidence_score -= 0.5;
      }
    }

    if (!parsed.location) {
      requires_manual_intervention = true;
      confidence_score -= 0.3;
    }

    return {
      items: resolvedItems,
      delivery_time: parsed.delivery_time || null,
      location: parsed.location || null,
      requires_manual_intervention,
      confidence_score: Math.max(0, confidence_score),
    };
  } catch (error: any) {
    logger.error({ error: error.message }, "AI Extraction failed");
    return {
      items: [],
      delivery_time: null,
      location: null,
      requires_manual_intervention: true,
      confidence_score: 0,
    };
  }
};
