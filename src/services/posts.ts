import type { PaginatedResponse } from "../types/api.js";
import type { Post } from "../types/db.js";
import { NotFoundError } from "../utils/errors.js";
import { paginateCollection } from "../utils/paginate.js";
import { getFirestoreDb } from "./firebase.js";

const COLLECTION = "posts";

export const postService = {
  async getById(id: string): Promise<Post> {
    const db = getFirestoreDb();
    const doc = await db.collection(COLLECTION).doc(id).get();

    if (!doc.exists) {
      throw new NotFoundError("Post not found");
    }

    return { id: doc.id, ...doc.data() } as Post;
  },

  /**
   * @deprecated Use getPostsPage for cursor-based pagination.
   */
  async list(limit: number, page: number): Promise<any> {
    const db = getFirestoreDb();
    const snapshot = await db
      .collection(COLLECTION)
      .orderBy("createdAt", "desc")
      .offset((page - 1) * limit)
      .limit(limit)
      .get();

    const countSnapshot = await db.collection(COLLECTION).count().get();
    const total = countSnapshot.data().count;

    const posts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Post);

    return {
      data: posts,
      pagination: {
        limit,
        page,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getPostsPage(limit: number, after?: string): Promise<PaginatedResponse<Post>> {
    const db = getFirestoreDb();
    const query = db.collection(COLLECTION).orderBy("createdAt", "desc");
    return paginateCollection<Post>(query, COLLECTION, limit, after);
  },

  async create(authorId: string, data: { title: string; content: string }): Promise<Post> {
    const db = getFirestoreDb();
    const post: Omit<Post, "id"> = {
      title: data.title,
      content: data.content,
      authorId,
      createdAt: new Date().toISOString(),
    };

    const docRef = await db.collection(COLLECTION).add(post);
    return { id: docRef.id, ...post };
  },

  async update(id: string, data: Partial<Pick<Post, "title" | "content">>): Promise<Post> {
    const db = getFirestoreDb();
    const updates = { ...data, updatedAt: new Date().toISOString() };

    await db.collection(COLLECTION).doc(id).update(updates);
    return this.getById(id);
  },

  async delete(id: string): Promise<void> {
    const db = getFirestoreDb();
    await db.collection(COLLECTION).doc(id).delete();
  },
};
