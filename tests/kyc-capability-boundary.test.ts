import { describe, it, expect } from "vitest";
import { hasPermission, ROLE_PRESETS } from "@/lib/admin/permissions";

/**
 * Reviewing a campaign must not include reading the fundraiser's identity.
 *
 * app/admin/campaigns/[id]/page.tsx is guarded by requirePermission("campaigns")
 * and it also rendered the OWNER's identity documents — the ID photo and the
 * biometric selfie — with signed URLs. So any admin who could review a campaign
 * could read the identity documents of every fundraiser behind one, whether or not
 * they held `kyc`, the capability that exists for exactly that data.
 *
 * The page now gates those documents on hasPermission(me, "kyc") and generates no
 * signed URL at all without it. These tests pin the boundary that makes the gate
 * meaningful: `campaigns` and `kyc` are genuinely separate capabilities, and
 * holding one must never imply the other.
 */
const admin = (perms: Record<string, boolean>) => ({
  id: "u1",
  isSuperAdmin: false,
  adminPermissions: perms,
});

describe("KYC is a capability of its own", () => {
  it("a campaigns-only admin does NOT hold kyc", () => {
    // The exact account the leak affected.
    const reviewer = admin({ campaigns: true });
    expect(hasPermission(reviewer, "campaigns")).toBe(true);
    expect(hasPermission(reviewer, "kyc")).toBe(false);
  });

  it("a kyc-only admin does NOT hold campaigns", () => {
    // The boundary in the other direction, so nobody "simplifies" them into one.
    const verifier = admin({ kyc: true });
    expect(hasPermission(verifier, "kyc")).toBe(true);
    expect(hasPermission(verifier, "campaigns")).toBe(false);
  });

  it("no capability leaks from an empty map", () => {
    const nobody = admin({});
    for (const key of ["kyc", "campaigns", "payouts", "content", "messages", "audit"] as const) {
      expect(hasPermission(nobody, key), key).toBe(false);
    }
  });

  it("a falsy or malformed permission value is not a grant", () => {
    // adminPermissions is JSON from the database; only an explicit `true` counts.
    for (const value of [false, "true", 1, null, undefined, {}, []] as unknown[]) {
      expect(
        hasPermission(admin({ kyc: value as boolean }), "kyc"),
        JSON.stringify(value)
      ).toBe(false);
    }
  });

  it("the main admin holds everything, including kyc", () => {
    const main = { id: "u2", isSuperAdmin: true, adminPermissions: {} };
    expect(hasPermission(main, "kyc")).toBe(true);
    expect(hasPermission(main, "campaigns")).toBe(true);
  });

  it("the compliance preset grants BOTH, which is why the leak went unnoticed", () => {
    // Every preset that grants campaigns also grants kyc, so in normal use the two
    // travelled together and nothing looked wrong. The capability map allows any
    // mix, though — a hand-built campaigns-only admin is what exposed it.
    const compliance = ROLE_PRESETS.find((p) => p.key === "compliance");
    expect(compliance?.perms).toContain("campaigns");
    expect(compliance?.perms).toContain("kyc");

    // And no preset grants campaigns WITHOUT kyc. If one ever does, this fails and
    // whoever added it has to think about identity documents.
    for (const preset of ROLE_PRESETS) {
      if (preset.perms.includes("campaigns")) {
        expect(preset.perms, `preset "${preset.key}"`).toContain("kyc");
      }
    }
  });
});
