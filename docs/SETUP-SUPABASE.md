# Supabase setup for Yewogen Derash

The app needs one Supabase project. It provides two things:

1. **PostgreSQL database** — all app data (users, campaigns, donations, payouts…)
2. **Storage** — two buckets: `yd-kyc` (private, ID documents & selfies) and `yd-media` (public, campaign hero images)

> **Shared project note.** This Supabase project is shared with the user's other
> apps. Everything Yewogen Derash creates is prefixed **`yd_`** (tables) / **`yd-`**
> (buckets) and lives in the default `public` schema. Nothing here ever touches
> objects that don't start with `yd`. That's why the connection strings below
> have **no `schema=` parameter**.

Follow the steps in order. You only do this once.

---

## Step 1 — Create the project

1. Go to <https://supabase.com> → **Sign in** (GitHub login is easiest)
2. Click **New project**
3. Fill in:
   - **Name:** `yewogen-derash`
   - **Database password:** click **Generate a password**, then **copy it somewhere safe immediately** — you need it in Step 2 and Supabase won't show it again
   - **Region:** `Central EU (Frankfurt)` — closest to Ethiopia
4. Click **Create new project** and wait ~2 minutes while it provisions

## Step 2 — Database connection strings

1. On your project's home page, click the **Connect** button (top bar)
2. Choose the **Connection string** tab → **URI**
3. You'll see connection strings for different "methods". Copy these two:

   | Supabase calls it | Port | Goes into `.env` as |
   |---|---|---|
   | **Transaction pooler** | `6543` | `DATABASE_URL` |
   | **Session pooler** | `5432` | `DIRECT_URL` |

4. In both strings, replace `[YOUR-PASSWORD]` with the database password from Step 1
5. Keep `?pgbouncer=true` on the pooler URL. **Do not add a `schema=` parameter** —
   our tables use the default `public` schema (isolation is via the `yd_` prefix).

   Final shape (example):

   ```
   DATABASE_URL=postgresql://postgres.abcdefghijk:MyPassw0rd@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   DIRECT_URL=postgresql://postgres.abcdefghijk:MyPassw0rd@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   ```

   > If your password contains `@ # % &` or other special characters, URL-encode
   > them (e.g. `@` → `%40`) or regenerate a simpler one in
   > Project Settings → Database → Reset database password.

## Step 3 — API keys

1. Go to **Project Settings** (gear icon) → **API Keys**
2. Copy:

   | Key | Goes into `.env` as |
   |---|---|
   | **Project URL** (also under Settings → General) | `NEXT_PUBLIC_SUPABASE_URL` |
   | **anon / public** key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
   | **service_role** key (click *Reveal*) | `SUPABASE_SERVICE_ROLE_KEY` |

   > Newer Supabase dashboards call these **Publishable key** (`sb_publishable_…`)
   > and **Secret key** (`sb_secret_…`) — same roles, both work.

   ⚠️ The service_role/secret key bypasses all security rules. It lives only in
   `.env` (which is gitignored) and is never sent to the browser.

## Step 4 — Paste into `.env`

Open `.env` in the project root and replace the five values from Steps 2–3:

```
DATABASE_URL=…            (Step 2)
DIRECT_URL=…              (Step 2)
NEXT_PUBLIC_SUPABASE_URL=…        (Step 3)
NEXT_PUBLIC_SUPABASE_ANON_KEY=…   (Step 3)
SUPABASE_SERVICE_ROLE_KEY=…       (Step 3)
```

## Step 5 — Let the tooling finish the job

These are run from the project root (Claude can run them for you):

```bash
# 0. Safety check — lists existing tables, confirms no yd_ collision and that
#    no other project's tables will be touched (shared-DB rule)
node scripts/db-preflight.mjs .env

# 1. Create the 12 yd_ tables in the public schema
npx prisma db push

# 2. Seed the admin account + demo campaigns
npx prisma db seed

# 3. Create the two storage buckets (yd-kyc private, yd-media public)
node scripts/setup-storage.mjs .env

# 4. Start the app
npm run dev
```

Seeded logins (change in any real environment):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@yewogenderash.local` | `ChangeMe-Dev-Only-1!` |
| Demo owner | `owner@demo.local` | `Demo-Owner-1!` |

---

## Later (not needed for local development)

- **Chapa keys** (`CHAPA_SECRET_KEY`, `CHAPA_WEBHOOK_SECRET`) — from
  <https://dashboard.chapa.co> → Settings → API. Needed to test real donations;
  locally the thank-you page confirms payments even without the webhook.
- **Webhook URL** — once deployed, set
  `https://<your-domain>/api/webhooks/chapa` in Chapa's dashboard and put the
  same secret in `CHAPA_WEBHOOK_SECRET`.
