# Yewogen Derash (ወገን ደራሽ)

A secure, corporate-grade crowdfunding platform for Ethiopia.

**Core guarantees:**

- Every campaign owner is identity-verified (ID documents + live face capture + manual admin review).
- Every campaign has its own unique querycode and QR code — a QR opens exactly one campaign.
- Funds never mix: one campaign = one donation ledger = one payout summary.
- No payment is marked successful without gateway webhook verification (Chapa).
- Every admin action is audit-logged.

## Stack

| Layer      | Choice                                        |
| ---------- | --------------------------------------------- |
| Framework  | Next.js (App Router, TypeScript, full-stack)  |
| Styling    | Tailwind CSS v4 + shadcn-style UI primitives  |
| Database   | PostgreSQL (Supabase) via Prisma              |
| Storage    | Supabase Storage (KYC docs, campaign media)   |
| Auth       | Auth.js (NextAuth) — RBAC: donor/owner/admin  |
| Payments   | Chapa (webhook-verified)                      |
| Alerts     | CallMeBot WhatsApp                            |
| Charts     | Recharts                                      |
| Tests      | Vitest + Playwright                           |

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in real values
npx prisma migrate dev
npm run dev
```

## Project docs

The build brief (source of truth) lives with the owner; this repo implements it
phase by phase. See commit history for phase boundaries.

---

Designed & built by [MuleSoo Digital Services](https://mulesoo.com).
