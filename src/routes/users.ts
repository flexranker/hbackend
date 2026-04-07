import { type NextFunction, type Request, type Response, Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { userRateLimiter } from "../middleware/rateLimit.js";
import { userService } from "../services/users.js";
import { createUserSchema, getUserSchema, updateUserSchema } from "../types/api.js";
import { validate, validateParams } from "../utils/validator.js";

const router = Router();

router.get(
  "/:id",
  authenticate,
  userRateLimiter,
  validateParams(getUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.getById(req.params.id);
      res.json(user);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/",
  authenticate,
  userRateLimiter,
  validate(createUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const reqID = req.user?.uid;
    if (!reqID) {
      return res.status(400).json({ error: "User ID is required" });
    }
    try {
      const user = await userService.create(reqID, {
        email: req.user?.email || req.body.email,
        name: req.body.name,
        avatar: req.body.avatar,
      });
      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/:id",
  authenticate,
  userRateLimiter,
  validateParams(getUserSchema),
  validate(updateUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user?.uid !== req.params.id) {
        return res.status(403).json({ error: "You can only update your own profile" });
      }
      const user = await userService.update(req.params.id, req.body);
      res.json(user);
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/:id",
  authenticate,
  userRateLimiter,
  validateParams(getUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user?.uid !== req.params.id) {
        return res.status(403).json({ error: "You can only delete your own account" });
      }
      await userService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

export default router;
