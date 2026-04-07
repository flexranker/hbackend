import prisma from "../lib/prisma.js";

export const createCustomer = async (data: {
  name: string;
  email: string;
  phone?: string;
  companyName?: string;
}) => {
  return await prisma.customer.create({ data });
};

export const getCustomers = async () => {
  return await prisma.customer.findMany();
};
