import { type NextFunction, type Request, type Response, Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { userRateLimiter } from "../middleware/rateLimit.js";
import { postService } from "../services/posts.js";
import {
  createPostSchema,
  getPostSchema,
  listPostsSchema,
  updatePostSchema,
} from "../types/api.js";
import { validate, validateParams, validateQuery } from "../utils/validator.js";

const router = Router();

router.get(
  "/",
  authenticate,
  userRateLimiter,
  validateQuery(listPostsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const page = parseInt(req.query.page as string, 10) || 1;
      const posts = await postService.list(limit, page);
      res.json(posts);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/:id",
  authenticate,
  userRateLimiter,
  validateParams(getPostSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = await postService.getById(req.params.id);
      res.json(post);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/",
  authenticate,
  userRateLimiter,
  validate(createPostSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const reqID = req.user?.uid;
    if (!reqID) {
      return res.status(400).json({ error: "User ID is required" });
    }
    try {
      const post = await postService.create(reqID, req.body);
      res.status(201).json(post);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/:id",
  authenticate,
  userRateLimiter,
  validateParams(getPostSchema),
  validate(updatePostSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = await postService.getById(req.params.id);
      if (post.authorId !== req.user?.uid) {
        return res.status(403).json({ error: "You can only update your own posts" });
      }
      const updated = await postService.update(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/:id",
  authenticate,
  userRateLimiter,
  validateParams(getPostSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = await postService.getById(req.params.id);
      if (post.authorId !== req.user?.uid) {
        return res.status(403).json({ error: "You can only delete your own posts" });
      }
      await postService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

export default router;
