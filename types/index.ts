/**
 * Shared type definitions for the psychological consultation platform.
 */

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

/**
 * Common pagination query parameters.
 */
export interface PaginationParams {
  page?: number;
  perPage?: number;
}

/**
 * Standard paginated response envelope.
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}
