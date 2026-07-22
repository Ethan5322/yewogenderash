import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

/** Hard defaults — also the fallback if the singleton row is somehow missing. */
export const DEFAULT_FEE_RATE = 0.03;
export const DEFAULT_AUTO_APPROVE_MAX_ETB = 5000;
export const DEFAULT_MIN_PAYOUT_ETB = 100;

export type PlatformSettings = {
  feeRate: number;
  autoApproveMaxEtb: number;
  minPayoutEtb: number;
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
    select: { feeRate: true, autoApproveMaxEtb: true, minPayoutEtb: true },
  });
  return row;
});

/** Persist a policy change (super-admin only — enforced at the call site). */
export async function updatePlatformSettings(input: {
  feeRate: number;
  autoApproveMaxEtb: number;
  minPayoutEtb: number;
  updatedById: string;
}): Promise<void> {
  const data = {
    feeRate: input.feeRate,
    autoApproveMaxEtb: input.autoApproveMaxEtb,
    minPayoutEtb: input.minPayoutEtb,
    updatedById: input.updatedById,
  };
  await db.platformSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
}
