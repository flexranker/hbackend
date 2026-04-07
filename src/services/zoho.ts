import axios from "axios";
import { config } from "../config.js";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";

const zohoClient = axios.create({
  baseURL: config.zoho.apiUrl,
  headers: {
    Authorization: `Zoho-oauthtoken ${config.zoho.authToken}`,
    "X-com-zoho-books-organizationid": config.zoho.orgId,
    "Content-Type": "application/json",
  },
});

export const createEstimate = async (orderId: string) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) throw new Error("Order not found");

    const estimateData = {
      customer_name: order.customer.name,
      line_items: order.items
        .filter((item) => item.product !== null)
        .map((item) => ({
          name: item.product!.name,
          rate: Number(item.price),
          quantity: item.quantity,
        })),
      reference_number: order.id,
    };

    const response = await zohoClient.post("/estimates", estimateData);
    const estimateId = response.data.estimate.estimate_id;

    await prisma.order.update({
      where: { id: orderId },
      data: { zohoEstimateId: estimateId },
    });

    logger.info(`Zoho Estimate created for order ${orderId}: ${estimateId}`);
    return estimateId;
  } catch (error: any) {
    logger.error({ error: error.response?.data || error.message }, "Error creating Zoho Estimate");
    throw error;
  }
};

export const convertToInvoice = async (orderId: string) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || !order.zohoEstimateId) {
      throw new Error("Order or Zoho Estimate ID not found");
    }

    const response = await zohoClient.post(`/estimates/${order.zohoEstimateId}/invoice`, {});
    const invoiceId = response.data.invoice.invoice_id;

    await prisma.order.update({
      where: { id: orderId },
      data: {
        zohoInvoiceId: invoiceId,
        isInvoiced: true,
      },
    });

    logger.info(`Zoho Invoice created for order ${orderId}: ${invoiceId}`);
    return invoiceId;
  } catch (error: any) {
    logger.error(
      { error: error.response?.data || error.message },
      "Error converting Zoho Estimate to Invoice",
    );
    throw error;
  }
};
