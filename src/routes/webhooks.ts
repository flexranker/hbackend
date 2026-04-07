import { Router, urlencoded } from "express";
import { handleWhatsAppWebhook } from "../controllers/whatsapp.js";

const router = Router();

// Twilio sends application/x-www-form-urlencoded
router.post("/whatsapp", handleWhatsAppWebhook);

export default router;
