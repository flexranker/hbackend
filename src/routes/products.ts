import { Router } from "express";
import { z } from "zod";
import * as productService from "../services/products.js";
import { validate } from "../utils/validator.js";

const router = Router();

const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
});

router.post("/", validate(createProductSchema), async (req, res, next) => {
  try {
    const product = await productService.createProduct(req.body);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

router.get("/", async (_req, res, next) => {
  try {
    const products = await productService.getProducts();
    res.json(products);
  } catch (error) {
    next(error);
  }
});

export default router;
