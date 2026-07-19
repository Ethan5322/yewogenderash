/**
 * Phase 2 verification — auth + RBAC, end to end against a running dev server.
 * Usage: node scripts/verify-phase2.mjs [baseUrl]
 * Requires: dev server running (npm run dev) and a reachable database
 * seeded with the admin user (npx prisma db seed).
 *
 * Checks:
 *   1. Register a fresh donor via POST /api/register (201)
 *   2. Duplicate registration is rejected (409)
 *   3. Weak password is rejected (400)
 *   4. Login with wrong password fails (no session)
 *   5. Login with correct password yields a session with role DONOR
 *   6. /dashboard is reachable when logged in
 *   7. /admin redirects the donor away (RBAC)
 *   8. /admin without any session redirects to /login
 *   9. Admin (seed user) can log in and reach /admin
 *  10. A forged unsigned session cookie is rejected
 */

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");

let passed = 0;
let failed = 0;
function check(name, ok, extra = "") {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

/** Minimal cookie jar (enough for Auth.js on localhost). */
function makeJar() {
  const jar = new Map();
  return {
    absorb(res) {
      for (const line of res.headers.getSetCookie?.() ?? []) {
        const [pair] = line.split(";");
        const eq = pair.indexOf("=");
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (value === "" || /expires=Thu, 01 Jan 1970/i.test(line)) {
          jar.delete(name);
        } else {
          jar.set(name, value);
        }
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    has(name) {
      return [...jar.keys()].some((k) => k.includes(name));
    },
    set(name, value) {
      jar.set(name, value);
    },
    clear() {
      jar.clear();
    },
  };
}

async function req(jar, path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(jar ? { cookie: jar.header() } : {}),
    },
  });
  jar?.absorb(res);
  return res;
}

/** Auth.js v5 credentials sign-in: csrf token → callback POST. */
async function login(jar, email, password) {
  const csrfRes = await req(jar, "/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();
  const res = await req(jar, "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, email, password }),
  });
  // Follow the one redirect Auth.js issues so the session cookie settles.
  if (res.status >= 300 && res.status < 400) {
    await req(jar, new URL(res.headers.get("location"), BASE).pathname);
  }
  const session = await (await req(jar, "/api/auth/session")).json();
  return session?.user ?? null;
}

async function main() {
  const email = `verify-${Date.now()}@phase2.local`;
  const password = "Verify-Phase2-Pass1";

  console.log(`Phase 2 verification against ${BASE}\n`);

  // 1. Register a fresh donor
  let res = await fetch(`${BASE}/api/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Verify User", email, password }),
  });
  check("register new donor → 201", res.status === 201, `(got ${res.status})`);

  // 2. Duplicate registration
  res = await fetch(`${BASE}/api/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Verify User", email, password }),
  });
  check("duplicate email → 409", res.status === 409, `(got ${res.status})`);

  // 3. Weak password
  res = await fetch(`${BASE}/api/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Weak", email: `w${Date.now()}@x.local`, password: "short" }),
  });
  check("weak password → 400", res.status === 400, `(got ${res.status})`);

  // 4. Wrong password login
  const jar = makeJar();
  let user = await login(jar, email, "Wrong-Password-99");
  check("wrong password → no session", user === null);

  // 5. Correct login
  jar.clear();
  user = await login(jar, email, password);
  check(
    "correct login → session role DONOR",
    user?.email === email && user?.role === "DONOR",
    `(got ${JSON.stringify(user)})`
  );

  // 6. Dashboard reachable
  res = await req(jar, "/dashboard");
  check("donor can open /dashboard", res.status === 200, `(got ${res.status})`);

  // 7. Admin blocked for donor
  res = await req(jar, "/admin");
  const loc = res.headers.get("location") ?? "";
  check(
    "donor on /admin → redirected away",
    res.status >= 300 && res.status < 400 && !loc.includes("/admin"),
    `(got ${res.status} → ${loc})`
  );

  // 8. Admin with no session
  const anon = makeJar();
  res = await req(anon, "/admin");
  check(
    "anonymous /admin → login redirect",
    res.status >= 300 && res.status < 400,
    `(got ${res.status})`
  );

  // 9. Seed admin can reach /admin
  const adminJar = makeJar();
  const adminUser = await login(
    adminJar,
    process.env.SEED_ADMIN_EMAIL ?? "admin@yewogenderash.local",
    process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe-Dev-Only-1!"
  );
  check("admin login → role ADMIN", adminUser?.role === "ADMIN", `(got ${JSON.stringify(adminUser)})`);
  res = await req(adminJar, "/admin");
  check("admin can open /admin", res.status === 200, `(got ${res.status})`);

  // 10. Forged cookie
  const forged = makeJar();
  forged.set(
    "authjs.session-token",
    Buffer.from(JSON.stringify({ uid: "hacker", role: "ADMIN" })).toString("base64url")
  );
  res = await req(forged, "/admin");
  check(
    "forged session cookie rejected",
    res.status >= 300 && res.status < 400,
    `(got ${res.status})`
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("verification crashed:", err);
  process.exit(1);
});
