import prisma from "../lib/prisma.js";

export const createProduct = async (data: {
  name: string;
  description?: string;
  price: number;
}) => {
  return await prisma.product.create({
    data: {
      ...data,
      price: data.price,
    },
  });
};

export const getProducts = async () => {
  return await prisma.product.findMany();
};
