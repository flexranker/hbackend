import Fuse from "fuse.js";
import prisma from "../lib/prisma.js";
import logger from "./logger.js";

export type ResolutionStatus = "MATCH" | "NEEDS_CONFIRMATION" | "UNRECOGNIZED";

export interface ResolvedProduct {
  productId: string | null;
  status: ResolutionStatus;
  originalName: string;
  matchedName?: string;
}

export const resolveProduct = async (extractedName: string): Promise<ResolvedProduct> => {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    if (products.length === 0) {
      return { productId: null, status: "UNRECOGNIZED", originalName: extractedName };
    }

    const fuse = new Fuse(products, {
      keys: ["name"],
      includeScore: true,
      threshold: 0.5, // 0.5 means similarity 0.5
    });

    const results = fuse.search(extractedName);

    if (results.length === 0) {
      return { productId: null, status: "UNRECOGNIZED", originalName: extractedName };
    }

    const bestMatch = results[0];
    const score = bestMatch.score ?? 1.0;
    const similarity = 1 - score;

    if (similarity > 0.8) {
      return {
        productId: bestMatch.item.id,
        status: "MATCH",
        originalName: extractedName,
        matchedName: bestMatch.item.name,
      };
    } else if (similarity >= 0.5) {
      return {
        productId: bestMatch.item.id,
        status: "NEEDS_CONFIRMATION",
        originalName: extractedName,
        matchedName: bestMatch.item.name,
      };
    } else {
      return {
        productId: null,
        status: "UNRECOGNIZED",
        originalName: extractedName,
      };
    }
  } catch (error: any) {
    logger.error({ error: error.message }, "Error resolving product name");
    return { productId: null, status: "UNRECOGNIZED", originalName: extractedName };
  }
};
