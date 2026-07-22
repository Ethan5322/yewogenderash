import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

/** Hard defaults — also the fallback if the singleton row is somehow missing. */
export const DEFAULT_FEE_RATE = 0.03;
export const DEFAULT_AUTO_APPROVE_MAX_ETB = 5000;

export type PlatformSettings = {
  feeRate: number;
  autoApproveMaxEtb: number;
};

/**
 * Editable platform policy (fee rate + auto-approval ceiling). Reads the single
 * "singleton" row, creating it with defaults on first access. Per-request cached
 * so a page can read it freely without extra round-trips.
 */
export const getPlatformSettings = cache(async (): Promise<PlatformSettings> => {
  const row = await db.platformSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
    select: { feeRate: true, autoApproveMaxEtb: true },
  });
  return row;
});

/** Persist a policy change (super-admin only — enforced at the call site). */
export async function updatePlatformSettings(input: {
  feeRate: number;
  autoApproveMaxEtb: number;
  updatedById: string;
}): Promise<void> {
  await db.platformSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      feeRate: input.feeRate,
      autoApproveMaxEtb: input.autoApproveMaxEtb,
      updatedById: input.updatedById,
    },
    update: {
      feeRate: input.feeRate,
      autoApproveMaxEtb: input.autoApproveMaxEtb,
      updatedById: input.updatedById,
    },
  });
}
