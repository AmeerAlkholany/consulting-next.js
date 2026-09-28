import { describe, expect, it } from "vitest";
import { calculatePagination } from "@/lib/pagination";

describe("calculatePagination", () => {
  it("computes page, skip, and take for a middle page", () => {
    expect(calculatePagination(3, 10, 25)).toEqual({
      page: 3,
      perPage: 10,
      total: 25,
      totalPages: 3,
      skip: 20,
      take: 10,
      hasMore: false,
      hasPrevious: true,
    });
  });

  it("reports more pages available when the current page is not the last", () => {
    const info = calculatePagination(1, 10, 100);
    expect(info.totalPages).toBe(10);
    expect(info.skip).toBe(0);
    expect(info.hasMore).toBe(true);
    expect(info.hasPrevious).toBe(false);
  });

  it("clamps invalid page and per-page values", () => {
    const info = calculatePagination(0, 0, 0);
    expect(info.page).toBe(1);
    expect(info.perPage).toBe(1);
    expect(info.totalPages).toBe(0);
    expect(info.hasMore).toBe(false);
    expect(info.hasPrevious).toBe(false);
  });

  it("applies defaults", () => {
    expect(calculatePagination()).toMatchObject({ page: 1, perPage: 20, skip: 0, take: 20 });
  });
});
