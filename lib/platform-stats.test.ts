import { describe, it, expect } from "vitest";
import { compactETB } from "@/lib/platform-stats";

describe("compactETB", () => {
  it("abbreviates millions to one decimal", () => {
    expect(compactETB(1_200_000)).toBe("ETB 1.2M");
    expect(compactETB(2_450_000)).toBe("ETB 2.5M");
  });

  it("drops the decimal past ten million", () => {
    expect(compactETB(12_400_000)).toBe("ETB 12M");
  });

  it("abbreviates ten thousand and above to K", () => {
    expect(compactETB(450_000)).toBe("ETB 450K");
    expect(compactETB(12_450)).toBe("ETB 12K");
  });

  it("shows smaller amounts in full", () => {
    expect(compactETB(9_999)).toBe("ETB 9,999");
    expect(compactETB(0)).toBe("ETB 0");
  });

  it("never renders a negative figure", () => {
    expect(compactETB(-500)).toBe("ETB 0");
  });

  it("honours a different currency label", () => {
    expect(compactETB(1_500_000, "USD")).toBe("USD 1.5M");
  });
});
