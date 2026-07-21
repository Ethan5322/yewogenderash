import "server-only";
import { randomInt } from "crypto";
import { db } from "@/lib/db";

// Charset excludes lookalikes (0/O, 1/I/L) — codes are typed by hand from
// posters and read aloud, so ambiguity is a donation lost.
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

function randomCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_CHARS[randomInt(CODE_CHARS.length)];
  }
  return out;
}

/**
 * Generate a querycode that is unique across all campaigns.
 * One campaign = one querycode, forever — codes are never reused or shared.
 */
export async function generateUniqueQueryCode(): Promise<string> {
  // 31^8 ≈ 8.5e11 combinations — collisions are vanishingly rare, but the
  // DB unique constraint is the real guarantee; this loop just avoids
  // surfacing constraint errors to users.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const clash = await db.campaign.findUnique({
      where: { queryCode: code },
      select: { id: true },
    });
    if (!clash) return code;
  }
  throw new Error("Could not generate a unique querycode after 5 attempts");
}

/**
 * Public owner verification code, e.g. YWD-A1B2C3 — printed on the author
 * profile as a trust signal. Unique across all owners.
 */
export async function generateUniqueAuthorCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    let tail = "";
    for (let i = 0; i < 6; i++) tail += CODE_CHARS[randomInt(CODE_CHARS.length)];
    const code = `YWD-${tail}`;
    const clash = await db.campaignOwner.findUnique({
      where: { authorCode: code },
      select: { id: true },
    });
    if (!clash) return code;
  }
  throw new Error("Could not generate a unique author code after 5 attempts");
}

/**
 * Staff identifier for an admin / sub-admin, e.g. YWD-ADM-7KQ2. Unique across
 * all users. Issued when an admin account is created.
 */
export async function generateUniqueAdminCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    let tail = "";
    for (let i = 0; i < 4; i++) tail += CODE_CHARS[randomInt(CODE_CHARS.length)];
    const code = `YWD-ADM-${tail}`;
    const clash = await db.user.findUnique({
      where: { adminCode: code },
      select: { id: true },
    });
    if (!clash) return code;
  }
  throw new Error("Could not generate a unique admin code after 5 attempts");
}

/** URL-safe slug from a title, deduplicated with a short random suffix. */
export async function generateUniqueSlug(title: string): Promise<string> {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // strip diacritics
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "campaign";

  const clash = await db.campaign.findUnique({
    where: { slug: base },
    select: { id: true },
  });
  if (!clash) return base;

  // Suffix with a short random tag until free (bounded).
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${randomCode().slice(0, 4).toLowerCase()}`;
    const taken = await db.campaign.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  throw new Error("Could not generate a unique slug after 5 attempts");
}
