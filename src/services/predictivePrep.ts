import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "../lib/prisma.js";
import { config } from "../config.js";
import logger from "../utils/logger.js";

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export interface IngredientUsage {
  ingredientId: string;
  ingredientName: string;
  expectedQty: number;
  unit: string;
}

export const calculateExpectedUsage = async (orderId: string): Promise<IngredientUsage[]> => {
  const orderItems = await prisma.orderItem.findMany({
    where: { orderId },
    include: {
      product: {
        include: {
          recipes: {
            include: {
              ingredient: true,
            },
          },
        },
      },
    },
  });

  const ingredientMap = new Map<string, { name: string; qty: number; unit: string }>();

  for (const item of orderItems) {
    for (const recipe of item.product.recipes) {
      const existing = ingredientMap.get(recipe.ingredientId) || {
        name: recipe.ingredient.name,
        qty: 0,
        unit: recipe.ingredient.unit,
      };
      const addedQty = Number(recipe.quantityPerUnit) * item.quantity;
      ingredientMap.set(recipe.ingredientId, {
        ...existing,
        qty: existing.qty + addedQty,
      });
    }
  }

  return Array.from(ingredientMap.entries()).map(([id, data]) => ({
    ingredientId: id,
    ingredientName: data.name,
    expectedQty: data.qty,
    unit: data.unit,
  }));
};

export const submitWastageReport = async (
  orderId: string,
  chefId: string,
  usages: { ingredientId: string; actualQty: number }[]
) => {
  const expectedUsages = await calculateExpectedUsage(orderId);
  const expectedMap = new Map(expectedUsages.map((u) => [u.ingredientId, u.expectedQty]));

  const reports = await Promise.all(
    usages.map((u) => {
      const expected = expectedMap.get(u.ingredientId) || 0;
      const wastage = u.actualQty - expected;

      return prisma.wastageReport.create({
        data: {
          orderId,
          chefId,
          ingredientId: u.ingredientId,
          actualQty: u.actualQty,
          expectedQty: expected,
          wastage: wastage,
        },
      });
    })
  );

  return reports;
};

export const analyzeWastageTrends = async () => {
  try {
    const historicalWastage = await prisma.wastageReport.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: {
        ingredient: true,
        order: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (historicalWastage.length === 0) return "No wastage data available for analysis.";

    const prompt = `
      Analyze the following kitchen wastage data and identify trends.
      Focus on identifying specific chefs or menu items that are consistently over-consuming ingredients.
      Data: ${JSON.stringify(historicalWastage)}
      
      Return a summary identifying the top 3 anomalies and suggesting improvements.
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error: any) {
    logger.error({ error: error.message }, "Wastage trend analysis failed");
    return "Analysis failed.";
  }
};
