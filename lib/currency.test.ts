import { describe, it, expect, afterEach } from "vitest";
import { etbPerUsd, indicativeUsd, roundIndicative } from "@/lib/currency";

const KEY = "NEXT_PUBLIC_ETB_PER_USD";
const original = process.env[KEY];

afterEach(() => {
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
});

describe("etbPerUsd", () => {
  it("is null when unconfigured, so no conversion is shown", () => {
    delete process.env[KEY];
    expect(etbPerUsd()).toBeNull();
    expect(indicativeUsd(10_000)).toBeNull();
  });

  it("rejects nonsense rather than showing a wrong figure", () => {
    for (const bad of ["0", "-50", "abc", "", "1000000"]) {
      process.env[KEY] = bad;
      expect(etbPerUsd()).toBeNull();
    }
  });

  it("accepts a sane configured rate", () => {
    process.env[KEY] = "140";
    expect(etbPerUsd()).toBe(140);
  });
});

describe("roundIndicative", () => {
  it("keeps small amounts to whole dollars", () => {
    expect(roundIndicative(7.4)).toBe(7);
    expect(roundIndicative(19.6)).toBe(20);
  });

  it("rounds mid amounts to the nearest 5", () => {
    expect(roundIndicative(103)).toBe(105);
    expect(roundIndicative(322)).toBe(320);
  });

  it("rounds large amounts to the nearest 50", () => {
    expect(roundIndicative(3_212)).toBe(3_200);
  });
});

describe("indicativeUsd", () => {
  it("renders an estimate, never a price", () => {
    process.env[KEY] = "140";
    const out = indicativeUsd(14_000);
    expect(out).toBe("≈ USD 100");
    expect(out?.startsWith("≈")).toBe(true);
  });

  it("returns null for zero or negative amounts", () => {
    process.env[KEY] = "140";
    expect(indicativeUsd(0)).toBeNull();
    expect(indicativeUsd(-5)).toBeNull();
  });

  it("returns null when the converted figure rounds away to nothing", () => {
    process.env[KEY] = "140";
    expect(indicativeUsd(20)).toBeNull(); // 0.14 USD -> 0
  });
});
