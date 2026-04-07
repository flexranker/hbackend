import type { PaginatedResponse } from "../types/api.js";
import { getFirestoreDb } from "../services/firebase.js";

/**
 * Standard pagination for Firestore collections using cursors.
 */
export async function paginateCollection<T>(
  query: FirebaseFirestore.Query,
  collectionName: string,
  limit: number,
  afterCursor?: string,
): Promise<PaginatedResponse<T>> {
  let q = query.limit(limit + 1); // fetch one extra to determine hasMore

  if (afterCursor) {
    const cursorDoc = await getFirestoreDb().collection(collectionName).doc(afterCursor).get();
    if (cursorDoc.exists) {
      q = q.startAfter(cursorDoc);
    }
  }

  const snapshot = await q.get();
  const docs = snapshot.docs;
  const hasMore = docs.length > limit;
  const items = docs.slice(0, limit).map((d) => ({ id: d.id, ...d.data() }) as T);
  const nextCursor = hasMore ? docs[limit - 1].id : null;

  return { items, nextCursor, hasMore };
}

/**
 * @deprecated Use paginateCollection for cursor-based pagination.
 */
export function paginate<T>(
  data: T[],
  limit: number,
  page: number,
  total: number,
): any {
  return {
    data,
    pagination: {
      limit,
      page,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * @deprecated Use paginateCollection for cursor-based pagination.
 */
export function getOffset(limit: number, page: number): number {
  return (page - 1) * limit;
}
