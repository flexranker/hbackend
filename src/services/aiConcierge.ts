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
  targetOrderId?: string;
  dietaryFindings?: { label: string; details: string; isCritical: boolean }[];
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
        Talking to: ${userContext.name || "a new customer"}.
        
        CONTEXT:
        - History: ${JSON.stringify(userContext.orderHistory || [])}
        - Safety: ${JSON.stringify(userContext.dietaryNotes || [])}

        RULES:
        1. REGISTRATION: Ask for Name and Company if unknown. Intent: "REGISTRATION".
        2. CANCELLATION: Identify order ID to cancel. Intent: "CANCEL".
        3. ORDERING: Extract items. If vague, use history. Intent: "ORDER".
        4. DIETARY: Scan message for allergies/preferences. If found, include in 'dietaryFindings'.
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
    }

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(result.response.text());

    // Resolve products in parallel for speed
    if (parsed.intent === "ORDER" && parsed.items) {
      await Promise.all(
        parsed.items.map(async (item: any) => {
          const resolved = await resolveProduct(item.name);
          item.productId = resolved.productId;
        })
      );
    }

    return parsed as ConciergeResponse;
  } catch (error: any) {
    logger.error({ error: error.message }, "AIConciergeService failed");
    return {
      intent: "INQUIRY",
      items: [],
      friendly_reply: `Glitch: ${error.message}. Please try again.`,
    };
  }
};
