# Deploy Yewogen Derash to Vercel

The code is on GitHub at `Ethan5322/yewogenderash` (branch `master`). These are
the steps to put it live on Vercel.

> **Secrets:** the actual environment values live in **`.env.vercel`** on the
> dev machine (gitignored — never pushed). Open that file to copy the values;
> this guide intentionally contains none.

## 1. Import the repo
1. Vercel → **Add New → Project → Import** → `Ethan5322/yewogenderash`.
2. Framework preset auto-detects **Next.js**. Leave build & output settings at
   the defaults — the repo's build script already runs `prisma generate && next
   build`, and `postinstall` also generates the client.

## 2. Add environment variables
In **Settings → Environment Variables**, use **"Paste .env"** (bulk add) and
paste the whole contents of `.env.vercel`. Tick **Production + Preview +
Development** for each.

The full list (14 vars): `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, `DIRECT_URL`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, `AUTH_TRUST_HOST`,
`CHAPA_SECRET_KEY`, `CHAPA_PUBLIC_KEY`, `CHAPA_ENCRYPTION_KEY`,
`CHAPA_WEBHOOK_SECRET`, `ADMIN_WHATSAPP_PHONE`, `ADMIN_CALLMEBOT_APIKEY`.

## 3. Deploy
Click **Deploy**. The database schema is already applied in Supabase (the
`yd_` tables), so no migration step runs at deploy time.

## 4. Fix the two deploy-dependent vars, then redeploy
1. **`NEXT_PUBLIC_APP_URL`** → set to the exact URL Vercel assigned
   (e.g. `https://yewogenderash.vercel.app`). This powers QR codes and Chapa
   return URLs, so it must match the live domain.
2. **`CHAPA_WEBHOOK_SECRET`** → in Chapa Dashboard → **Settings → Webhooks**:
   - Webhook URL: `https://<your-domain>/api/webhooks/chapa`
   - Copy the **Secret Hash** and paste it as this variable's value.
3. **Redeploy** (Deployments → ⋯ → Redeploy) so the new values take effect.

## 5. Verify live
- Visit the site; log in as the main admin (credentials are the owner's — see
  the account set in the DB, not stored here).
- Open a campaign → **Donate** with a real email (Gmail/Yahoo/Outlook — Chapa
  rejects domains without mail servers) → Chapa test checkout → returns to
  `/donate/thanks` and settles.
- Scan a campaign QR from any phone — it now points to the real domain.

## Notes
- These are Chapa **TEST** keys. Swap to **live** keys (and re-do the webhook
  secret) only when taking real money.
- Consider making the GitHub repo **private** — it holds the full business logic.
- Shared Supabase project: only `yd_`-prefixed tables/buckets belong to this app.
