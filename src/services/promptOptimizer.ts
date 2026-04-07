import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { setSystemPrompt } from "./aiExtractor.js";
import cron from "node-cron";

const BASE_PROMPT = `
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

export const initPromptOptimizer = () => {
  // Run daily at 1 AM: "0 1 * * *"
  cron.schedule("0 1 * * *", async () => {
    logger.info("Running Prompt Optimization loop...");
    await optimizePrompt();
  });

  logger.info("PromptOptimizer initialized.");
};

export const optimizePrompt = async () => {
  try {
    // 1. Get the top 5 most frequent AI mistakes from the CorrectionLedger
    const frequentMistakes = await prisma.correctionLedger.findMany({
      take: 5,
      orderBy: { fieldsCorrected: "desc" },
      include: {
        order: true,
      },
    });

    if (frequentMistakes.length === 0) {
      logger.info("No corrections found. Skipping optimization.");
      return;
    }

    // 2. Build Few-Shot Examples block
    let fewShotBlock = "\n\n### LEARNING FROM PREVIOUS MISTAKES (Few-Shot Examples):\n";

    for (const entry of frequentMistakes) {
      const original = JSON.stringify(entry.originalAiData);
      const corrected = JSON.stringify(entry.adminCorrectedData);

      fewShotBlock += `
      Mistake Case:
      - AI originally extracted: ${original}
      - Admin manually corrected to: ${corrected}
      - Instruction: Do not repeat this mistake. Ensure accuracy for these specific fields.
      `;
    }

    // 3. Inject into AIExtractorService
    const finalPrompt = BASE_PROMPT + fewShotBlock;
    setSystemPrompt(finalPrompt);

    logger.info(`Prompt optimized with ${frequentMistakes.length} correction examples.`);
  } catch (error: any) {
    logger.error({ error: error.message }, "Prompt optimization failed");
  }
};
