import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";

export const logCorrection = async (
  orderId: string,
  originalAiData: any,
  correctedData: any
) => {
  try {
    // Basic diff logic
    let fieldsCorrected = 0;
    
    // Compare top level fields (notes, location, time)
    if (originalAiData.notes !== correctedData.notes) fieldsCorrected++;
    if (originalAiData.extractedLocation !== correctedData.extractedLocation) fieldsCorrected++;
    if (originalAiData.extractedTime !== correctedData.extractedTime) fieldsCorrected++;
    
    // Compare items (simplistic count diff)
    const originalItemsCount = originalAiData.items?.length || 0;
    const correctedItemsCount = correctedData.items?.length || 0;
    if (originalItemsCount !== correctedItemsCount) {
      fieldsCorrected += Math.abs(correctedItemsCount - originalItemsCount);
    }

    return await prisma.correctionLedger.create({
      data: {
        orderId,
        originalAiData,
        adminCorrectedData: correctedData,
        fieldsCorrected,
      },
    });
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to log correction");
  }
};

export const getAiAccuracyStats = async () => {
  const ledger = await prisma.correctionLedger.findMany();
  
  if (ledger.length === 0) return { accuracy: 100, totalOrdersChecked: 0 };

  const totalPossibleFields = ledger.length * 5; // Assuming 5 key fields tracked
  const totalCorrections = ledger.reduce((acc, curr) => acc + curr.fieldsCorrected, 0);

  const accuracy = ((totalPossibleFields - totalCorrections) / totalPossibleFields) * 100;

  return {
    accuracy: Math.max(0, accuracy),
    totalOrdersChecked: ledger.length,
    totalCorrections,
  };
};
