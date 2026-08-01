/**
 * Seed a LOCAL database with accounts the e2e suite can sign in as.
 *
 * Why this exists: all 35 e2e tests only covered ANONYMOUS visitors. Nothing
 * exercised the fundraiser dashboard, the withdraw form, or the admin panel in a
 * browser — because the e2e dev server pointed at the real Supabase, so signing in
 * would have meant creating accounts in production. That gap is also what stopped
 * me verifying a rewrite of how KYC documents load.
 *
 *   DATABASE_URL=postgresql://...localhost... node scripts/seed-e2e.mjs
 *
 * REFUSES a non-local database. It creates users with KNOWN passwords; running it
 * against production would plant credentials an attacker could simply read here.
 */
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Client } from "pg";
import { createHash } from "node:crypto";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url) || /supabase/i.test(url)) {
  console.error(
    "Refusing to run: DATABASE_URL is not a local database.\n" +
      "This seeds accounts with known passwords — never point it at production."
  );
  process.exit(1);
}

/**
 * Fixed, obviously-fake credentials. Committed on purpose: they only ever exist in
 * a throwaway local database, and the e2e specs need to know them. The guard above
 * is what keeps them from ever reaching a real system.
 */
export const E2E_USERS = {
  admin: { email: "e2e-admin@test.local", password: "e2e-Admin-Passw0rd!" },
  fundraiser: { email: "e2e-owner@test.local", password: "e2e-Owner-Passw0rd!" },
  donor: { email: "e2e-donor@test.local", password: "e2e-Donor-Passw0rd!" },
};

/** The 2FA code the seeded admin can sign in with. See below for why it is fixed. */
export const E2E_ADMIN_2FA = "424242";

const client = new Client({ connectionString: url });
await client.connect();

const hash = (pw) => bcrypt.hashSync(pw, 10);
const sha = (s) => createHash("sha256").update(s).digest("hex");

async function upsertUser({ email, password }, role, extra = {}) {
  const id = `e2e-${role.toLowerCase()}-fixed`;
  const cols = {
    id,
    name: `E2E ${role}`,
    email,
    passwordHash: hash(password),
    role,
    emailVerifiedAt: new Date(),
    ...extra,
  };
  // Delete-then-insert rather than upsert: a re-seed must produce an identical
  // account, not merge into whatever a previous test run left behind.
  await client.query(`DELETE FROM "yd_users" WHERE "id" = $1 OR "email" = $2`, [
    id,
    email,
  ]);
  const keys = Object.keys(cols);
  await client.query(
    `INSERT INTO "yd_users" (${keys.map((k) => `"${k}"`).join(",")},"updatedAt")
     VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")}, now())`,
    keys.map((k) => cols[k])
  );
  return id;
}

const adminId = await upsertUser(E2E_USERS.admin, "ADMIN", {
  isSuperAdmin: true,
  adminCode: "YWD-ADM-E2E1",
});
const ownerUserId = await upsertUser(E2E_USERS.fundraiser, "OWNER", {
  verificationStatus: "VERIFIED",
});
await upsertUser(E2E_USERS.donor, "DONOR");

/**
 * A long-lived LOGIN_2FA code for the admin.
 *
 * Admin sign-in requires a second factor delivered by WhatsApp, which a test
 * cannot receive. Rather than weaken that requirement — the policy is never to
 * bypass 2FA — the seed inserts a code row directly, exactly as createOtp would,
 * and the test types it. The production path is completely untouched: this is one
 * row in a throwaway database.
 *
 * Ten years of validity so a slow first Next compile cannot expire it mid-run.
 */
await client.query(`DELETE FROM "yd_otp_codes" WHERE "userId" = $1`, [adminId]);
await client.query(
  `INSERT INTO "yd_otp_codes" ("id","userId","purpose","codeHash","expiresAt","createdAt")
   VALUES ($1,$2,'LOGIN_2FA',$3, now() + interval '10 years', now())`,
  [randomUUID(), adminId, sha(E2E_ADMIN_2FA)]
);

// A verified fundraiser profile, so /dashboard has something to show.
await client.query(`DELETE FROM "yd_campaign_owners" WHERE "userId" = $1`, [
  ownerUserId,
]);
const ownerId = "e2e-owner-profile-fixed";
await client.query(
  `INSERT INTO "yd_campaign_owners"
     ("id","userId","authorCode","mulesooVerified","verifiedAt","biometricStatus","updatedAt")
   VALUES ($1,$2,'AC-E2E-0001',true, now(),'VERIFIED', now())`,
  [ownerId, ownerUserId]
);

// One ACTIVE campaign, so the dashboard and the public pages have real content.
await client.query(`DELETE FROM "yd_campaigns" WHERE "ownerId" = $1`, [ownerId]);
await client.query(
  `INSERT INTO "yd_campaigns"
     ("id","ownerId","title","slug","description","category","targetAmount",
      "currentAmount","queryCode","status","updatedAt")
   VALUES ('e2e-campaign-fixed',$1,'E2E Test Campaign','e2e-test-campaign',
           'Seeded for end-to-end tests.','MEDICAL',10000,0,'QC-E2E-001','ACTIVE', now())`,
  [ownerId]
);

await client.end();

console.log("Seeded e2e accounts:");
console.log(`  admin       ${E2E_USERS.admin.email}   (2FA ${E2E_ADMIN_2FA})`);
console.log(`  fundraiser  ${E2E_USERS.fundraiser.email}`);
console.log(`  donor       ${E2E_USERS.donor.email}`);
