import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import { config } from "../config.js";
import logger from "../utils/logger.js";
import { resolveProduct } from "../utils/productResolver.js";

async function fetchRemoteFile(url: string): Promise<{ data: string; mimeType: string }> {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  const base64 = Buffer.from(response.data, "binary").toString("base64");
  const mimeType = response.headers["content-type"];
  return { data: base64, mimeType };
}

export interface ConciergeResponse {
  intent: "ORDER" | "INQUIRY" | "UPDATE" | "REGISTRATION" | "CANCEL";
  items: { name: string; qty: number; productId?: string | null }[];
  total_price?: number;
  friendly_reply: string;
  registrationData?: { name: string; companyName: string };
  targetOrderId?: string; // For cancellations or updates
}

export const processConciergeMessage = async (
  rawText: string,
  userContext: any,
  mediaUrl?: string
): Promise<ConciergeResponse> => {
  try {
    if (!config.gemini.apiKey) {
      throw new Error("GEMINI_API_KEY is missing in configuration");
    }

    const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      systemInstruction: `
        You are an AI Concierge for Snap Order, a professional catering service.
        You are talking to ${userContext.name || "a new customer"}.
        
        USER CONTEXT:
        - Customer Name: ${userContext.name || "Unknown"}
        - Company: ${userContext.companyName || "Unknown"}
        - Last 3 Orders: ${JSON.stringify(userContext.orderHistory || [])}
        - Dietary Notes: ${JSON.stringify(userContext.dietaryNotes || [])}
        - Special Discounts: ${JSON.stringify(userContext.contractPrices || [])}

        RULES:
        1. REGISTRATION: If user is unknown, ask for their Full Name and Company Name. If they provide it, set intent to "REGISTRATION" and include registrationData.
        2. CANCELLATION: If they want to cancel an order, identify the order ID from history. Set intent to "CANCEL" and include targetOrderId.
        3. ORDERING: If they send an image or text order, extract items. If vague, use history. Set intent to "ORDER".
        4. INQUIRY: If they ask about status, use the history provided to answer.
        5. Return a strictly formatted JSON object.
      `,
    });

    let parts: any[] = [{ text: rawText }];

    if (mediaUrl) {
      const fileData = await fetchRemoteFile(mediaUrl);
      parts.push({
        inlineData: {
          data: fileData.data,
          mimeType: fileData.mimeType,
        },
      });
      parts.push({ text: "Analyze this media file for the request." });
    }

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(result.response.text());

    // Resolve products for items
    if (parsed.intent === "ORDER" && parsed.items) {
      for (const item of parsed.items) {
        const resolved = await resolveProduct(item.name);
        item.productId = resolved.productId;
      }
    }

    return parsed as ConciergeResponse;
  } catch (error: any) {
    logger.error({ error: error.message }, "AIConciergeService failed");
    return {
      intent: "INQUIRY",
      items: [],
      friendly_reply: `I'm sorry, I'm having a technical glitch (${error.message}). Please try again or contact support.`,
    };
  }
};
