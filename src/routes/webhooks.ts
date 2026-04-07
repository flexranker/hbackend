import { Router, urlencoded } from "express";
import { handleWhatsAppWebhook } from "../controllers/whatsapp.js";

const router = Router();

// Twilio sends application/x-www-form-urlencoded
router.post("/whatsapp", urlencoded({ extended: false }), handleWhatsAppWebhook);

export default router;
