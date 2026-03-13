import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Pure pagination math extracted from the listings route
function paginate<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const start = (page - 1) * pageSize;
  const results = items.slice(start, start + pageSize);
  return {
    results,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize),
  };
}

describe("paginate()", () => {
  const items = Array.from({ length: 50 }, (_, i) => i + 1);

  it("returns first page correctly", () => {
    const res = paginate(items, 1, 24);
    assert.equal(res.results.length, 24);
    assert.equal(res.results[0], 1);
    assert.equal(res.total, 50);
    assert.equal(res.total_pages, 3);
    assert.equal(res.page, 1);
  });

  it("returns last partial page correctly", () => {
    const res = paginate(items, 3, 24);
    assert.equal(res.results.length, 2); // 50 - 48 = 2
    assert.equal(res.results[0], 49);
  });

  it("returns empty results for out-of-range page", () => {
    const res = paginate(items, 99, 24);
    assert.equal(res.results.length, 0);
    assert.equal(res.total, 50);
  });

  it("total_pages is 1 when all items fit in one page", () => {
    const res = paginate(items, 1, 100);
    assert.equal(res.total_pages, 1);
    assert.equal(res.results.length, 50);
  });

  it("total_pages rounds up", () => {
    const res = paginate(items, 1, 7);
    assert.equal(res.total_pages, Math.ceil(50 / 7)); // 8
  });

  it("empty list returns zero total and pages", () => {
    const res = paginate([], 1, 24);
    assert.equal(res.total, 0);
    assert.equal(res.total_pages, 0);
    assert.equal(res.results.length, 0);
  });
});
