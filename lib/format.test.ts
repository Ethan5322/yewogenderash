import { describe, it, expect } from "vitest";
import { toNumber, formatETB, progressPercent } from "@/lib/format";

describe("toNumber", () => {
  it("passes numbers through", () => {
    expect(toNumber(42)).toBe(42);
  });
  it("coerces Decimal-like strings", () => {
    expect(toNumber("12500.50")).toBe(12500.5);
  });
  it("coerces objects with toString (Prisma Decimal shape)", () => {
    expect(toNumber({ toString: () => "999.99" })).toBe(999.99);
  });
});

describe("formatETB", () => {
  it("shows whole birr with no decimals and grouping", () => {
    expect(formatETB(12500)).toBe("ETB 12,500");
  });
  it("keeps two decimals only when there is a fractional part", () => {
    expect(formatETB(12500.5)).toBe("ETB 12,500.5");
    expect(formatETB(12500.55)).toBe("ETB 12,500.55");
  });
  it("honours a custom currency label", () => {
    expect(formatETB(100, "USD")).toBe("USD 100");
  });
});

describe("progressPercent", () => {
  it("computes a rounded percentage", () => {
    expect(progressPercent(50, 200)).toBe(25);
  });
  it("clamps above 100", () => {
    expect(progressPercent(300, 200)).toBe(100);
  });
  it("clamps below 0", () => {
    expect(progressPercent(-10, 200)).toBe(0);
  });
  it("returns 0 for a non-positive target instead of dividing by zero", () => {
    expect(progressPercent(50, 0)).toBe(0);
  });
});
