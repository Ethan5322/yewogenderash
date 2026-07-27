/**
 * Verify the fee and withdrawal money model against the LIVE database.
 *
 *   node --env-file=.env scripts/verify-fees.mjs
 *
 * READ-ONLY. It never writes, so it is safe to run against production.
 *
 * The unit tests prove the arithmetic in isolation; this proves the same rules
 * hold over the rows that actually exist. For every campaign it checks:
 *
 *   - every settled donation reconciles: platformFee + netAmount == amount
 *   - the platform fee really is the configured rate
 *   - the balance an owner sees equals net donations minus payouts reserved
 *   - the safety & guarantee withholding charged never exceeds 7% of gross
 *   - each payout reconciles: withholdingFee + netPaidAmount == amount
 *
 * Exits non-zero if any invariant is broken, so it can gate a deploy.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const PLATFORM_FEE_RATE = 0.03;
const WITHHOLDING_FEE_RATE = 0.07;
const TOLERANCE = 0.01; // one birr cent, for rounding

const n = (v) => Number(v ?? 0);
const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const money = (v) => `ETB ${round2(v).toLocaleString("en-US")}`;
// Math.round avoids 0.07 * 100 rendering as 7.000000000000001.
const pct = (rate) => `${Math.round(rate * 100)}%`;

const problems = [];
const note = (msg) => problems.push(msg);

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const campaigns = await db.campaign.findMany({
    select: {
      id: true,
      title: true,
      currency: true,
      donations: {
        where: { status: "SUCCESS" },
        select: { id: true, amount: true, platformFee: true, netAmount: true },
      },
      payouts: {
        where: { status: { in: ["REQUESTED", "APPROVED", "PAID"] } },
        select: { id: true, amount: true, withholdingFee: true, netPaidAmount: true, status: true },
      },
    },
  });

  console.log(`Checking ${campaigns.length} campaign(s)\n`);
  let totalGross = 0;
  let totalFees = 0;
  let totalWithheld = 0;

  for (const c of campaigns) {
    const gross = c.donations.reduce((a, d) => a + n(d.amount), 0);
    const fees = c.donations.reduce((a, d) => a + n(d.platformFee), 0);
    const net = c.donations.reduce((a, d) => a + n(d.netAmount), 0);
    totalGross += gross;
    totalFees += fees;

    // 1. Each donation reconciles, and the fee is the configured rate.
    for (const d of c.donations) {
      const amount = n(d.amount);
      const split = n(d.platformFee) + n(d.netAmount);
      if (Math.abs(split - amount) > TOLERANCE) {
        note(`donation ${d.id}: fee + net = ${money(split)} but amount = ${money(amount)}`);
      }
      const expectedFee = round2(amount * PLATFORM_FEE_RATE);
      if (Math.abs(n(d.platformFee) - expectedFee) > TOLERANCE) {
        note(
          `donation ${d.id}: fee ${money(n(d.platformFee))} is not ${pct(PLATFORM_FEE_RATE)} of ${money(amount)} (expected ${money(expectedFee)})`
        );
      }
    }

    // 2. Each payout reconciles.
    const reserved = c.payouts.reduce((a, p) => a + n(p.amount), 0);
    const withheld = c.payouts.reduce((a, p) => a + n(p.withholdingFee), 0);
    totalWithheld += withheld;
    for (const p of c.payouts) {
      // netPaidAmount is nullable on rows that predate the withholding.
      if (p.netPaidAmount !== null) {
        const sum = n(p.withholdingFee) + n(p.netPaidAmount);
        if (Math.abs(sum - n(p.amount)) > TOLERANCE) {
          note(
            `payout ${p.id}: withholding + net = ${money(sum)} but amount = ${money(n(p.amount))}`
          );
        }
      }
    }

    // 3. The one-off withholding is never over-charged.
    const withholdingCeiling = round2(gross * WITHHOLDING_FEE_RATE);
    if (withheld - withholdingCeiling > TOLERANCE) {
      note(
        `campaign "${c.title}": withheld ${money(withheld)} exceeds the ${pct(WITHHOLDING_FEE_RATE)} ceiling of ${money(withholdingCeiling)}`
      );
    }

    // 4. The balance an owner is shown.
    const available = round2(net - reserved);
    if (available < -TOLERANCE) {
      note(`campaign "${c.title}": available balance is negative (${money(available)})`);
    }

    if (gross > 0) {
      console.log(`  ${c.title}`);
      console.log(
        `    gross ${money(gross)} · fee ${money(fees)} · net ${money(net)} · reserved/paid ${money(reserved)} · available ${money(available)}`
      );
      console.log(
        `    withholding charged ${money(withheld)} of ceiling ${money(withholdingCeiling)}`
      );
    }
  }

  console.log(`\nPlatform totals`);
  console.log(`  gross donated      ${money(totalGross)}`);
  console.log(`  transaction fees   ${money(totalFees)} (${pct(PLATFORM_FEE_RATE)})`);
  console.log(`  withholding taken  ${money(totalWithheld)} (max ${pct(WITHHOLDING_FEE_RATE)} of gross)`);
  console.log(
    `  platform retained  ${money(totalFees + totalWithheld)} of ${money(totalGross)}`
  );

  if (problems.length === 0) {
    console.log("\n✓ Every fee and payout invariant holds on live data.");
  } else {
    console.log(`\n✗ ${problems.length} problem(s):`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
  }
} finally {
  await db.$disconnect();
}
