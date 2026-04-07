import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { userRateLimiter } from "../middleware/rateLimit.js";
import { generateUploadUrl } from "../services/uploads.js";
import { uploadSchema } from "../types/api.js";
import { validate } from "../utils/validator.js";

const router = Router();

/**
 * POST /api/uploads/presigned
 * Body: { fileType, fileName, fileSizeBytes }
 * Returns: { uploadUrl, storagePath }
 *
 * The client uses the uploadUrl to PUT the file directly to Firebase Storage.
 * No file bytes pass through the backend server.
 */
router.post(
  "/presigned",
  authenticate,
  userRateLimiter,
  validate(uploadSchema),
  async (req, res, next) => {
    try {
      const { fileType, fileName, fileSizeBytes } = req.body;
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = await generateUploadUrl(uid, fileName, fileType, fileSizeBytes);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
