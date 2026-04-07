import type { User } from "../types/db.js";
import { NotFoundError } from "../utils/errors.js";
import { getFirestoreDb } from "./firebase.js";

const COLLECTION = "users";

export const userService = {
  async getById(id: string): Promise<User> {
    const db = getFirestoreDb();
    const doc = await db.collection(COLLECTION).doc(id).get();

    if (!doc.exists) {
      throw new NotFoundError("User not found");
    }

    return { id: doc.id, ...doc.data() } as User;
  },

  async create(id: string, data: { email: string; name: string; avatar?: string }): Promise<User> {
    const db = getFirestoreDb();
    const user: User = {
      id,
      email: data.email,
      name: data.name,
      avatar: data.avatar,
      createdAt: new Date().toISOString(),
    };

    await db.collection(COLLECTION).doc(id).set(user);
    return user;
  },

  async update(id: string, data: Partial<Pick<User, "name" | "avatar">>): Promise<User> {
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
