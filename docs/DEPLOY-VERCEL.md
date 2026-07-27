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

The full list (14 required vars): `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`,
`DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, `AUTH_TRUST_HOST`,
`CHAPA_SECRET_KEY`, `CHAPA_PUBLIC_KEY`, `CHAPA_ENCRYPTION_KEY`,
`CHAPA_WEBHOOK_SECRET`, `ADMIN_WHATSAPP_PHONE`, `ADMIN_CALLMEBOT_APIKEY`.

`ADMIN_WHATSAPP_PHONE` + `ADMIN_CALLMEBOT_APIKEY` are **load-bearing for
main-admin sign-in**: the main admin's one-time login code is delivered to that
WhatsApp number. A CallMeBot key is issued for one specific number, so the two
must be a matched pair — a key that does not belong to the phone will fail
silently. If delivery fails the sign-in screen says so and the code is still
written to the application log, so the main admin is never locked out. Delegated
(sub-)admins sign in with their password and need no code.

**Optional:**

- `NEXT_PUBLIC_ETB_PER_USD` — approximate birr per 1 USD. Shows diaspora donors
  a secondary "≈ USD" figure beside birr amounts. **Leave it unset unless you
  intend to keep it current**: nothing is displayed when it is unset, which is
  the safe state — a stale rate printed next to a real amount of money is worse
  than no conversion at all. Revisit it whenever the rate moves materially.
- `FACE_SERVICE_URL` / `FACE_API_KEY` — the InsightFace comparison service. Unset
  means face matching falls back to the in-browser engine.

## 3. Check the schema is current, then deploy
No migration runs at deploy time — the `yd_` tables are applied directly to
Supabase. So before deploying, confirm the live database has every migration the
code expects:

```bash
node scripts/check-schema-drift.mjs .env
```

It prints any table or column the code needs that the database does not have,
and names the migration file to apply. Apply anything missing with:

```bash
node scripts/apply-migration.mjs supabase/migrations/<file>.sql .env
```

Migrations are additive and safe to re-run. The most recent is
`0017_yd_add_withholding_fee.sql`, which adds the safety & guarantee withholding
columns to `yd_payouts`; **a deploy without it will fail at runtime on the
payouts screens.** Note that the combined paste file
`supabase/migrations/0002-0007_combined_paste-into-supabase.sql` stops at 0007 —
0008 onwards must be applied individually.

Then click **Deploy**.

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
