import { Router } from "express";
import { z } from "zod";
import * as customerService from "../services/customers.js";
import { validate } from "../utils/validator.js";

const router = Router();

const createCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  companyName: z.string().optional(),
});

router.post("/", validate(createCustomerSchema), async (req, res, next) => {
  try {
    const customer = await customerService.createCustomer(req.body);
    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
});

router.get("/", async (_req, res, next) => {
  try {
    const customers = await customerService.getCustomers();
    res.json(customers);
  } catch (error) {
    next(error);
  }
});

export default router;
