import { describe, it, expect } from "vitest";
import { computeFeeSplit, PLATFORM_FEE_RATE } from "./fees";

describe("computeFeeSplit", () => {
  it("takes 3% by default and reconciles to gross exactly", () => {
    const { gross, fee, net, rate } = computeFeeSplit(100);
    expect(rate).toBe(PLATFORM_FEE_RATE);
    expect(gross).toBe(100);
    expect(fee).toBe(3);
    expect(net).toBe(97);
    expect(fee + net).toBe(gross);
  });

  it("rounds to 2 decimals without float drift", () => {
    const { fee, net } = computeFeeSplit(99.99);
    // 3% of 99.99 = 2.9997 -> 3.00; net = 96.99
    expect(fee).toBe(3);
    expect(net).toBe(96.99);
    expect(Number((fee + net).toFixed(2))).toBe(99.99);
  });

  it("handles small amounts", () => {
    const { fee, net } = computeFeeSplit(10);
    expect(fee).toBe(0.3);
    expect(net).toBe(9.7);
  });

  it("always reconciles: fee + net === gross for many values", () => {
    for (const g of [10, 33.33, 250, 1000.5, 7777.77, 1_000_000]) {
      const { gross, fee, net } = computeFeeSplit(g);
      expect(Number((fee + net).toFixed(2))).toBe(Number(gross.toFixed(2)));
    }
  });

  it("respects a custom rate", () => {
    const { fee, net } = computeFeeSplit(200, 0.05);
    expect(fee).toBe(10);
    expect(net).toBe(190);
  });
});
