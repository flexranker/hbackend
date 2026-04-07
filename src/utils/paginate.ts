import type { PaginatedResponse } from "../types/db.js";

export function paginate<T>(
  data: T[],
  limit: number,
  page: number,
  total: number,
): PaginatedResponse<T> {
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

export function getOffset(limit: number, page: number): number {
  return (page - 1) * limit;
}
