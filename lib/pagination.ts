/**
 * Pagination helper calculations.
 */

export interface PaginationInfo {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  skip: number;
  take: number;
  hasMore: boolean;
  hasPrevious: boolean;
}

export function calculatePagination(page = 1, perPage = 20, total = 0): PaginationInfo {
  const safePage = Math.max(1, page);
  const safePerPage = Math.max(1, perPage);
  const totalPages = Math.ceil(total / safePerPage);
  const skip = (safePage - 1) * safePerPage;

  return {
    page: safePage,
    perPage: safePerPage,
    total,
    totalPages,
    skip,
    take: safePerPage,
    hasMore: safePage < totalPages,
    hasPrevious: safePage > 1,
  };
}
