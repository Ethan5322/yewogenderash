import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { isActiveAdmin } from "@/lib/admin/active-admin";

/**
 * Whether someone is an admin must come from the DATABASE, not from their token.
 *
 * The bug: /a/[authorCode] is a PUBLIC page that shows an admin a signed URL to a
 * fundraiser's biometric selfie, and it decided who was an admin by reading
 * `session.user.role` out of the JWT. Sessions last 7 days, so a demoted,
 * suspended or offboarded admin kept a token asserting ADMIN — and with it,
 * access to other people's biometric identity data, from a page with no admin
 * guard in front of it.
 *
 * These tests are the reason to prefer isActiveAdmin: they change the DB row and
 * assert the answer changes immediately, which is exactly what a JWT cannot do.
 */
const url = process.env.DATABASE_URL ?? "";
const isLocal =
  process.env.INTEGRATION_DB === "1" &&
  /@(127\.0\.0\.1|localhost)[:/]/.test(url) &&
  !/supabase/i.test(url);

const sfx = Math.random().toString(36).slice(2, 10);
const adminId = `aa-admin-${sfx}`;
const donorId = `aa-donor-${sfx}`;

async function makeUser(id: string, role: "ADMIN" | "DONOR" | "OWNER") {
  await db.user.create({
    data: {
      id,
      name: `Test ${role}`,
      email: `${id}@test.local`,
      passwordHash: "x",
      role,
    },
  });
}

describe.skipIf(!isLocal)("isActiveAdmin reads the database, not a token", () => {
  beforeAll(async () => {
    await makeUser(adminId, "ADMIN");
    await makeUser(donorId, "DONOR");
  });

  afterAll(async () => {
    if (!isLocal) return;
    await db.user.deleteMany({ where: { id: { in: [adminId, donorId] } } });
    await db.$disconnect();
  });

  it("says yes for a current admin", async () => {
    expect(await isActiveAdmin(adminId)).toBe(true);
  });

  it("says no for a non-admin", async () => {
    expect(await isActiveAdmin(donorId)).toBe(false);
  });

  it("says no for nobody — an absent session must never read as admin", async () => {
    expect(await isActiveAdmin(null)).toBe(false);
    expect(await isActiveAdmin(undefined)).toBe(false);
    expect(await isActiveAdmin("")).toBe(false);
    // A deleted account whose token is still in someone's browser.
    expect(await isActiveAdmin(`aa-ghost-${sfx}`)).toBe(false);
  });

  it("says no the moment an admin is DEMOTED", async () => {
    // The whole point. With the old JWT check this user would have kept
    // biometric access for up to seven more days.
    await db.user.update({ where: { id: adminId }, data: { role: "OWNER" } });
    expect(await isActiveAdmin(adminId)).toBe(false);
    await db.user.update({ where: { id: adminId }, data: { role: "ADMIN" } });
  });

  it("says no the moment an admin is BANNED, even while still role ADMIN", async () => {
    // Sign-in already refuses banned users, but only for NEW sessions. A session
    // issued before the ban is untouched by that check, so this is the gate that
    // actually stops them.
    await db.user.update({ where: { id: adminId }, data: { isBanned: true } });
    const row = await db.user.findUniqueOrThrow({
      where: { id: adminId },
      select: { role: true, isBanned: true },
    });
    expect(row.role).toBe("ADMIN"); // still nominally an admin
    expect(row.isBanned).toBe(true);
    expect(await isActiveAdmin(adminId)).toBe(false); // and still refused

    await db.user.update({ where: { id: adminId }, data: { isBanned: false } });
  });
});

describe.skipIf(isLocal)("isActiveAdmin integration tests", () => {
  it("skipped — needs INTEGRATION_DB=1 and a local database", () => {
    expect(isLocal).toBe(false);
  });
});
