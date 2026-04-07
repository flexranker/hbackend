import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  avatar: z.string().url().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  avatar: z.string().url().optional(),
});

export const getUserSchema = z.object({
  id: z.string(),
});

export const createPostSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
});

export const updatePostSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
});

export const getPostSchema = z.object({
  id: z.string(),
});

export const uploadSchema = z.object({
  fileType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  fileName: z.string().min(1).max(255),
  fileSizeBytes: z.number().int().positive().max(5 * 1024 * 1024), // 5 MB max
});

export const listPostsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(10),
  page: z.coerce.number().min(1).default(1),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type ListPostsInput = z.infer<typeof listPostsSchema>;

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number; // optional, only if cheap to compute
}

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  after: z.string().optional(), // cursor — the ID of the last item on the previous page
});
