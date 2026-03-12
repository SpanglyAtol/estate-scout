import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { haversineKm, KM_PER_MILE } from "../lib/geo";

describe("haversineKm", () => {
  it("returns 0 for identical points", () => {
    assert.equal(haversineKm(40.7128, -74.006, 40.7128, -74.006), 0);
  });

  it("calculates NYC → LA (~3,940 km) within 1% tolerance", () => {
    // New York City (40.7128, -74.0060) → Los Angeles (34.0522, -118.2437)
    const d = haversineKm(40.7128, -74.006, 34.0522, -118.2437);
    assert.ok(d > 3900 && d < 4000, `Expected ~3940 km, got ${d.toFixed(1)} km`);
  });

  it("is symmetric (A→B == B→A)", () => {
    const ab = haversineKm(51.5074, -0.1278, 48.8566, 2.3522); // London → Paris
    const ba = haversineKm(48.8566, 2.3522, 51.5074, -0.1278);
    assert.ok(Math.abs(ab - ba) < 0.001, "Distance should be symmetric");
  });

  it("London → Paris is approximately 341 km", () => {
    const d = haversineKm(51.5074, -0.1278, 48.8566, 2.3522);
    assert.ok(d > 335 && d < 345, `Expected ~341 km, got ${d.toFixed(1)} km`);
  });
});

describe("KM_PER_MILE", () => {
  it("is approximately 1.609", () => {
    assert.ok(KM_PER_MILE > 1.608 && KM_PER_MILE < 1.611);
  });

  it("converts 1 mile to km correctly", () => {
    const oneMileInKm = 1 * KM_PER_MILE;
    assert.ok(Math.abs(oneMileInKm - 1.60934) < 0.0001);
  });

  it("50 miles is ~80 km", () => {
    const km = 50 * KM_PER_MILE;
    assert.ok(km > 79 && km < 81, `Expected ~80 km, got ${km.toFixed(2)}`);
  });
});
