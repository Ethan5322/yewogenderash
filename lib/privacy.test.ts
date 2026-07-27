import { describe, it, expect } from "vitest";
import { maskDonorName, maskReference } from "@/lib/privacy";

describe("maskDonorName", () => {
  it("keeps a first name and abbreviates the surname", () => {
    expect(maskDonorName("Abebe Kebede")).toBe("Abebe K.");
    expect(maskDonorName("Hanna Girma Tesfaye")).toBe("Hanna G.");
  });

  it("uppercases the initial", () => {
    expect(maskDonorName("selam bekele")).toBe("selam B.");
  });

  it("treats missing, blank and anonymous the same", () => {
    expect(maskDonorName(null)).toBe("Anonymous");
    expect(maskDonorName(undefined)).toBe("Anonymous");
    expect(maskDonorName("   ")).toBe("Anonymous");
    expect(maskDonorName("Anonymous")).toBe("Anonymous");
    expect(maskDonorName("anonymous")).toBe("Anonymous");
  });

  it("passes through a single-word name", () => {
    expect(maskDonorName("Abebe")).toBe("Abebe");
  });

  it("collapses messy whitespace", () => {
    expect(maskDonorName("  Abebe   Kebede  ")).toBe("Abebe K.");
  });

  it("never returns a full surname", () => {
    for (const n of ["Abebe Kebede", "Hanna Girma Tesfaye", "X Yankelevich"]) {
      const masked = maskDonorName(n);
      const surname = n.split(" ")[1];
      expect(masked.includes(surname)).toBe(false);
    }
  });
});

describe("maskReference", () => {
  it("shows only the last few characters", () => {
    expect(maskReference("YWD-abcdef123456")).toBe("••••3456");
    expect(maskReference("YWD-abcdef123456", 6)).toBe("••••123456");
  });

  it("handles short and empty references", () => {
    expect(maskReference("ab")).toBe("••••ab");
    expect(maskReference("")).toBe("—");
    expect(maskReference(null)).toBe("—");
  });

  it("never reveals the leading part of a reference", () => {
    const ref = "YWD-SECRETPART-9999";
    expect(maskReference(ref).includes("SECRET")).toBe(false);
  });
});
