import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import { config } from "../config.js";
import logger from "../utils/logger.js";
import { type ResolvedProduct, resolveProduct } from "../utils/productResolver.js";

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

let systemInstruction = `
    You are an AI order extractor for a corporate catering system.
    Extract the following information from the provided text, image, or audio and return it as a strictly formatted JSON object.
    
    Fields:
    - items: array of objects with 'name' and 'qty' (number)
    - delivery_time: string or null if not mentioned
    - location: string or null if not mentioned

    Rules:
    - If a quantity is not explicitly mentioned but the item is, assume 1.
    - If the input is "Same as last time" or similar, return empty items array.
    - Only include items that are clearly food or beverage products.
`;

export const setSystemPrompt = (newPrompt: string) => {
  systemInstruction = newPrompt;
  logger.info("AIExtractorService: System prompt updated.");
};

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

async function fetchRemoteFile(url: string): Promise<{ data: string; mimeType: string }> {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  const base64 = Buffer.from(response.data, "binary").toString("base64");
  const mimeType = response.headers["content-type"];
  return { data: base64, mimeType };
}

export const extractOrderData = async (
  input: string,
  type: "text" | "image" | "audio" = "text",
): Promise<AIExtractedOrder> => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      systemInstruction,
    });

    let parts: any[] = [];

    if (type === "text") {
      parts = [{ text: `Extract order from this text: "${input}"` }];
    } else {
      // Handle URL or base64
      let fileData: { data: string; mimeType: string };
      if (input.startsWith("http")) {
        fileData = await fetchRemoteFile(input);
      } else {
        // Assume base64: mimeType;base64,data
        const [meta, data] = input.split(",");
        const mimeType = meta.split(":")[1].split(";")[0];
        fileData = { data, mimeType };
      }

      parts = [
        {
          inlineData: {
            data: fileData.data,
            mimeType: fileData.mimeType,
          },
        },
        { text: "Extract the order from this media file." },
      ];
    }

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
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
      const vagueTriggers = ["same", "usual", "repeat", "last time"];
      const isVague = type === "text" && vagueTriggers.some((t) => input.toLowerCase().includes(t));

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
