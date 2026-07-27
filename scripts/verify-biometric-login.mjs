/**
 * Verify the sign-in options end to end, without a camera.
 *
 *   node --env-file=.env scripts/verify-biometric-login.mjs
 *   node --env-file=.env scripts/verify-biometric-login.mjs --test-login
 *
 * Default run is READ-ONLY: it prints which admins have a staff code + face
 * template, and which fundraisers have an enrolled face.
 *
 * With --test-login it proves the whole chain (provider -> JWT -> session
 * cookie) for every option: staff code + face, staff code + password,
 * fundraiser code + face, fundraiser code + password — plus the rejections. It
 * TEMPORARILY enrols a synthetic descriptor on one admin and one owner and
 * restores whatever was there before. A synthetic template only exercises the
 * plumbing — a real face still has to be enrolled from the browser.
 *
 * Needs the dev server running on BASE (default http://localhost:3000).
 * Optional: ADMIN_PASSWORD / OWNER_PASSWORD to also check the password options.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const BASE = process.env.BASE ?? "http://localhost:3000";
const TEST_LOGIN = process.argv.includes("--test-login");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

/** A deterministic 128-D vector — stands in for a real face template. */
function syntheticDescriptor(seed = 7) {
  return Array.from({ length: 128 }, (_, i) => Math.sin(seed + i) * 0.1);
}

// ── minimal cookie jar ────────────────────────────────────────────
function jar() {
  const store = new Map();
  return {
    header: () => [...store].map(([k, v]) => `${k}=${v}`).join("; "),
    absorb(res) {
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(";");
        const idx = pair.indexOf("=");
        store.set(pair.slice(0, idx), pair.slice(idx + 1));
      }
    },
    has: (name) => [...store.keys()].some((k) => k.includes(name)),
  };
}

/** Drive one Credentials provider the way the browser does. */
async function signIn(providerId, fields) {
  const cookies = jar();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  cookies.absorb(csrfRes);
  const { csrfToken } = await csrfRes.json();

  const body = new URLSearchParams({ ...fields, csrfToken, json: "true" });
  const res = await fetch(`${BASE}/api/auth/callback/${providerId}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookies.header(),
    },
    body,
    redirect: "manual",
  });
  cookies.absorb(res);
  const text = await res.text();
  return { ok: cookies.has("session-token"), status: res.status, body: text.slice(0, 200) };
}

// ── report ────────────────────────────────────────────────────────
const admins = await db.user.findMany({
  where: { role: "ADMIN" },
  select: {
    id: true,
    email: true,
    adminCode: true,
    isSuperAdmin: true,
    idPhotoUrl: true,
    faceDescriptor: true,
    biometricEnrolledAt: true,
  },
  orderBy: [{ isSuperAdmin: "desc" }, { createdAt: "asc" }],
});

console.log("\nSTAFF (admin code + face template)");
for (const a of admins) {
  console.log(
    `  ${a.isSuperAdmin ? "MAIN " : "SUB  "} ${(a.adminCode ?? "—").padEnd(14)} ${a.email.padEnd(34)} ` +
      `photo:${a.idPhotoUrl ? "yes" : "no "} face:${a.faceDescriptor ? "yes" : "no "}`
  );
}

const owners = await db.campaignOwner.findMany({
  select: {
    authorCode: true,
    biometricStatus: true,
    faceDescriptor: true,
    user: { select: { email: true, role: true } },
  },
});
console.log("\nFUNDRAISERS (author code + face template)");
for (const o of owners) {
  console.log(
    `  ${(o.authorCode ?? "—").padEnd(14)} ${o.user.email.padEnd(34)} role:${o.user.role.padEnd(6)} ` +
      `biometric:${o.biometricStatus.padEnd(12)} face:${o.faceDescriptor ? "yes" : "no "}`
  );
}

if (!TEST_LOGIN) {
  console.log("\n(read-only — pass --test-login to exercise the sign-in routes)");
  await db.$disconnect();
  process.exit(0);
}

// ── live sign-in checks ───────────────────────────────────────────
const probe = syntheticDescriptor();
let failures = 0;
const check = (name, passed, extra = "") => {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!passed) failures++;
};

console.log("\nSIGN-IN CHECKS");

// 1. Staff code — face option, password option, and the rejections.
// Prefer an account with NO template so a real enrolled face is never touched;
// ADMIN_CODE / OWNER_CODE pin a specific account.
const admin =
  admins.find((a) => a.adminCode === process.env.ADMIN_CODE) ??
  admins.find((a) => a.adminCode && !a.faceDescriptor) ??
  admins.find((a) => a.adminCode);
if (!admin) {
  console.log("  SKIP  no admin has a staff code");
} else {
  const before = admin.faceDescriptor;
  await db.user.update({
    where: { id: admin.id },
    data: { faceDescriptor: JSON.stringify(probe), biometricEnrolledAt: new Date() },
  });
  try {
    const good = await signIn("admin-code", {
      code: admin.adminCode,
      password: "",
      faceDescriptor: JSON.stringify(probe),
    });
    check(`admin-code: ${admin.adminCode} + face (option 1)`, good.ok, good.body);

    if (process.env.ADMIN_PASSWORD) {
      const pw = await signIn("admin-code", {
        code: admin.adminCode,
        password: process.env.ADMIN_PASSWORD,
        faceDescriptor: "",
      });
      check(`admin-code: ${admin.adminCode} + password (option 2)`, pw.ok, pw.body);
    } else {
      console.log("  SKIP  admin-code + password (set ADMIN_PASSWORD to check)");
    }

    const wrongFace = await signIn("admin-code", {
      code: admin.adminCode,
      password: "",
      faceDescriptor: JSON.stringify(syntheticDescriptor(99)),
    });
    check("admin-code: a different face is rejected", !wrongFace.ok);

    const bare = await signIn("admin-code", {
      code: admin.adminCode,
      password: "",
      faceDescriptor: "",
    });
    check("admin-code: code with neither credential is rejected", !bare.ok);

    const wrongPw = await signIn("admin-code", {
      code: admin.adminCode,
      password: "definitely-not-the-password",
      faceDescriptor: "",
    });
    check("admin-code: a wrong password is rejected", !wrongPw.ok);
  } finally {
    await db.user.update({
      where: { id: admin.id },
      data: {
        faceDescriptor: before,
        biometricEnrolledAt: before ? admin.biometricEnrolledAt : null,
      },
    });
  }
}

// 2. Fundraiser code — face option, password option, and the rejections.
const isOwner = (o) => o.authorCode && o.user.role === "OWNER";
const owner =
  owners.find((o) => isOwner(o) && o.authorCode === process.env.OWNER_CODE) ??
  owners.find((o) => isOwner(o) && !o.faceDescriptor) ??
  owners.find(isOwner);
if (!owner) {
  console.log("  SKIP  no OWNER has an author code");
} else {
  const row = await db.campaignOwner.findUnique({
    where: { authorCode: owner.authorCode },
    select: { id: true, faceDescriptor: true },
  });
  await db.campaignOwner.update({ where: { id: row.id }, data: { faceDescriptor: probe } });
  try {
    const good = await signIn("fundraiser-code", {
      code: owner.authorCode,
      password: "",
      faceDescriptor: JSON.stringify(probe),
    });
    check(`fundraiser-code: ${owner.authorCode} + face, no password (option 1)`, good.ok, good.body);

    if (process.env.OWNER_PASSWORD) {
      const pw = await signIn("fundraiser-code", {
        code: owner.authorCode,
        password: process.env.OWNER_PASSWORD,
        faceDescriptor: "",
      });
      check(
        `fundraiser-code: ${owner.authorCode} + password, no face (option 2)`,
        pw.ok,
        pw.body
      );
    } else {
      console.log("  SKIP  fundraiser-code + password (set OWNER_PASSWORD to check)");
    }

    const wrongFace = await signIn("fundraiser-code", {
      code: owner.authorCode,
      password: "",
      faceDescriptor: JSON.stringify(syntheticDescriptor(99)),
    });
    check("fundraiser-code: a different face is rejected", !wrongFace.ok);

    const bare = await signIn("fundraiser-code", {
      code: owner.authorCode,
      password: "",
      faceDescriptor: "",
    });
    check("fundraiser-code: code with neither credential is rejected", !bare.ok);
  } finally {
    await db.campaignOwner.update({
      where: { id: row.id },
      data: { faceDescriptor: row.faceDescriptor ?? null },
    });
  }
}

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
await db.$disconnect();
process.exit(failures === 0 ? 0 : 1);
