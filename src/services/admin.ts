import { config } from "../config.js";
import { ForbiddenError, NotFoundError } from "../utils/errors.js";
import { getFirestoreDb } from "./firebase.js";

interface UserRecord {
  id: string;
  email?: string;
  name?: string;
  banned?: boolean;
  createdAt?: string;
}

interface PostRecord {
  id: string;
  title?: string;
  authorId?: string;
  featured?: boolean;
  createdAt?: string;
}

interface Stats {
  totalUsers: number;
  totalPosts: number;
  totalBannedUsers: number;
  featuredPosts: number;
}

const db = getFirestoreDb();

let adminUidsCache: { uids: string[]; expiresAt: number } | null = null;

export const adminService = {
  async getAdminUids(): Promise<string[]> {
    if (adminUidsCache && adminUidsCache.expiresAt > Date.now()) {
      return adminUidsCache.uids;
    }

    const doc = await db.collection("_admin").doc("config").get();
    const stored = (doc.data()?.adminUids as string[]) ?? [];

    // Merge env-bootstrapped UIDs with stored ones; env always wins
    const allAdmins = Array.from(new Set([...config.adminUids, ...stored]));

    adminUidsCache = {
      uids: allAdmins,
      expiresAt: Date.now() + 60 * 1000, // 60-second TTL
    };

    return allAdmins;
  },

  async addAdminUid(uid: string): Promise<void> {
    const docRef = db.collection("_admin").doc("config");
    const doc = await docRef.get();
    const stored = (doc.data()?.adminUids as string[]) ?? [];

    if (stored.includes(uid)) return;

    await docRef.set({ adminUids: [...stored, uid] }, { merge: true });

    // Invalidate cache
    adminUidsCache = null;
  },

  async removeAdminUid(uid: string): Promise<void> {
    if (config.adminUids.includes(uid)) {
      throw new ForbiddenError(
        "Cannot remove a bootstrap admin via API. Edit ADMIN_UIDS in .env.",
      );
    }

    const docRef = db.collection("_admin").doc("config");
    const doc = await docRef.get();
    const stored = (doc.data()?.adminUids as string[]) ?? [];

    if (!stored.includes(uid)) return;

    await docRef.set({ adminUids: stored.filter((u) => u !== uid) }, { merge: true });

    // Invalidate cache
    adminUidsCache = null;
  },

  async banUser(userId: string, reason?: string): Promise<UserRecord> {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new NotFoundError("User not found");
    }

    const updateData: Record<string, unknown> = {
      banned: true,
      bannedAt: new Date().toISOString(),
    };
    if (reason) {
      updateData.banReason = reason;
    }

    await userRef.update(updateData);
    const updated = await userRef.get();
    return { id: updated.id, ...updated.data() } as UserRecord;
  },

  async unbanUser(userId: string): Promise<UserRecord> {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new NotFoundError("User not found");
    }

    await userRef.update({
      banned: false,
      unbannedAt: new Date().toISOString(),
    });

    const updated = await userRef.get();
    return { id: updated.id, ...updated.data() } as UserRecord;
  },

  async featurePost(postId: string): Promise<PostRecord> {
    const postRef = db.collection("posts").doc(postId);
    const postDoc = await postRef.get();

    if (!postDoc.exists) {
      throw new NotFoundError("Post not found");
    }

    await postRef.update({
      featured: true,
      featuredAt: new Date().toISOString(),
    });

    const updated = await postRef.get();
    return { id: updated.id, ...updated.data() } as PostRecord;
  },

  async unfeaturePost(postId: string): Promise<PostRecord> {
    const postRef = db.collection("posts").doc(postId);
    const postDoc = await postRef.get();

    if (!postDoc.exists) {
      throw new NotFoundError("Post not found");
    }

    await postRef.update({
      featured: false,
    });

    const updated = await postRef.get();
    return { id: updated.id, ...updated.data() } as PostRecord;
  },

  async getStats(): Promise<Stats> {
    const [usersSnapshot, postsSnapshot, bannedSnapshot, featuredSnapshot] = await Promise.all([
      db.collection("users").count().get(),
      db.collection("posts").count().get(),
      db.collection("users").where("banned", "==", true).count().get(),
      db.collection("posts").where("featured", "==", true).count().get(),
    ]);

    return {
      totalUsers: usersSnapshot.data().count,
      totalPosts: postsSnapshot.data().count,
      totalBannedUsers: bannedSnapshot.data().count,
      featuredPosts: featuredSnapshot.data().count,
    };
  },

  async sendNotificationToAll(
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ sent: number }> {
    const usersSnapshot = await db.collection("users").get();
    const BATCH_SIZE = 500;
    const notificationData = {
      title,
      body,
      data: data || {},
      read: false,
      createdAt: new Date().toISOString(),
    };

    const userDocs = usersSnapshot.docs;
    let sent = 0;

    for (let i = 0; i < userDocs.length; i += BATCH_SIZE) {
      const chunk = userDocs.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      for (const userDoc of chunk) {
        const notificationRef = db
          .collection("users")
          .doc(userDoc.id)
          .collection("notifications")
          .doc();
        batch.set(notificationRef, notificationData);
      }

      await batch.commit();
      sent += chunk.length;
    }

    return { sent };
  },
};
