# Phase 5 — Automated Chapa transfers and reconciliation

**Status: 5a SHIPPED. 5b and 5c still to build.**

The owner's answers to §6, recorded 30 Jul 2026:
1. **An admin clicks "Send transfer"** — a human stays between a request and money
   leaving. Approval alone will not move funds.
2. **A ceiling, chosen as `PlatformSettings.maxAutoTransferEtb`, default 25,000
   ETB.** Above it the send button is refused and the transfer is done by hand as
   today, so a bug in the send path costs at most the ceiling rather than a
   campaign's whole balance. Editable by the main admin in Fees/Settings.
3. **The fundraiser is told automatically**, on both success and failure.

This phase is not like phases 1–4. Those changed how the app reasons about money
it already held. This one makes the app **move money out of the platform to
someone's bank account**, on its own, with no undo.

A donation that fails is retried by the donor and costs nothing. A transfer that
fires twice is money gone, to a real person, who may already have spent it. The
plan below is shaped almost entirely around that asymmetry.

---

## 1. Where things stand today

**The fundraiser side is finished** (phases 1–4): one withdrawal per campaign,
for the whole balance, only after closing, capped at 90% of gross, enforced by a
database constraint and covered by integration tests.

**The payment side is entirely manual.** From `app/admin/actions.ts`:

| Step | Who | What happens |
|---|---|---|
| Request | Fundraiser | `Payout` row created, `REQUESTED` (or auto-`APPROVED`) |
| Approve | Admin | status → `APPROVED` |
| **Transfer** | **Admin, by hand** | **outside the system entirely** |
| Mark paid | Admin | types a `payoutReference`, status → `PAID` |

So `PAID` currently means *"an admin says they sent it."* Nothing in the system
has ever spoken to a bank. There is no record of whether the transfer succeeded,
no way to tell a typo'd reference from a real one, and no way to answer "did this
fundraiser actually receive their money?" except asking them.

**What `lib/chapa.ts` already does:** `initializeChapaPayment`,
`verifyChapaTransaction`, `verifyChapaWebhookSignature`, `listChapaBanks`,
`createChapaSubaccount`. All of that is money coming **in**, plus bank metadata.
There is no transfer function. `PayoutAccount.chapaSubaccountId` and
`FeeLedger.chapaSubaccountId` exist, so the groundwork for identifying a
destination is partly laid.

---

## 2. Step 0 — DONE: Chapa's actual contract

Confirmed against developer.chapa.co, July 2026:

```
POST /v1/transfers
  required  account_number, amount, bank_code
  optional  account_name, currency, reference
  optional  status   TEST MODE ONLY - simulates success | failed | pending
GET  /v1/transfers/verify/<reference>
```

Two things this settles. **`reference` is a merchant-supplied value and is what
verify looks up** — so it is a real idempotency key, which the whole design
depended on. And **test mode can simulate failure and pending**, so the unhappy
paths are testable against Chapa rather than only against a stub.

One thing it does NOT settle: **their docs do not specify the response body for
either call.** So the code reads a status defensively and treats anything
unrecognised as UNKNOWN. See `normaliseTransferStatus` and its tests.

### The original Step 0 note, kept for the record

I know Chapa exposes a transfers capability. **I do not know its current exact
contract from memory, and I am not willing to guess at the shape of a request
that moves money.** Before any code:

- Read Chapa's live transfers documentation and confirm: endpoint paths, required
  fields, how a destination bank account is identified, what a success response
  guarantees (accepted vs settled), the status values, and how to query one
  transfer by reference.
- Confirm whether transfers need enabling on the account, and whether test keys
  can transfer at all.
- Confirm the webhook events for transfer outcomes, if any.

Everything below is structured so the details slot in once confirmed. If the API
turns out not to support something (idempotency keys, single-transfer lookup),
that changes the design and I will come back rather than improvise.

---

## 3. The failure that governs the design

Almost all the work is for one case:

> We send the transfer request. The connection dies. We never learn the outcome.

Money may or may not be moving. Both naive answers are wrong:

- Mark it failed and let someone retry → **pays twice.**
- Mark it paid → **may never arrive, and we have told the fundraiser it did.**

The only correct answer is a third state: **unknown, and never retried
automatically.** That is why reconciliation (§5) is not an optional extra — it is
the thing that resolves unknowns, and the feature is not safe without it.

Consequences that follow, and are non-negotiable:

1. **One transfer reference per payout, generated once, stored before the call.**
   Written to the database *before* Chapa is contacted, so a crash mid-flight
   leaves evidence. Never regenerated — a new reference is a second payment.
2. **A unique index on that reference**, like migration 0020. Phase 1 proved this
   codebase can lose a race between a check and an insert.
3. **No automatic retry, ever.** A `PENDING` transfer is resolved by asking Chapa
   what happened, never by sending again.
4. **The amount comes from the `Payout` row**, re-read inside the send path, never
   from a form field or a URL.

---

## 4. Sub-phase 5a — foundations (no money moves)

Shippable on its own, with the send path still disabled.

- **Migration 0021** adds to `yd_payouts`:
  - `transferReference TEXT` — ours, the idempotency key. Unique index.
  - `transferStatus TEXT` — `null | PENDING | SUCCESS | FAILED`
  - `transferAttemptedAt TIMESTAMP(3)`
  - `transferFailureReason TEXT`
  - `chapaTransferId TEXT` — whatever Chapa calls its own handle
  - Kept separate from `status`, which stays the human/business state. Mixing
    "an admin approved this" with "the bank moved it" into one column is how you
    end up unable to answer either question.
- `initiateChapaTransfer()` and `getChapaTransferStatus()` in `lib/chapa.ts`,
  matching the existing `{ ok: true, ... } | { ok: false, error }` style.
- `CHAPA_TRANSFERS_ENABLED` env flag, default **off**. Nothing can move money
  until it is deliberately switched on.
- Update `scripts/check-migration-parity.mjs` expectations (it will fail until
  schema and migration agree, which is the point).

## 5. Sub-phase 5b — the send path, and 5c — reconciliation

**5b, admin-triggered send.** A "Send transfer" action on an `APPROVED` payout:

1. Re-read the payout inside a transaction; refuse unless `APPROVED` and
   `transferStatus` is null.
2. Generate and store `transferReference`, set `transferStatus = PENDING`,
   `transferAttemptedAt`. Commit **before** calling Chapa.
3. Call Chapa.
4. On a clear success → `SUCCESS`, store `chapaTransferId`, `status = PAID`,
   `paidAt`. On a clear rejection → `FAILED` with the reason; `status` stays
   `APPROVED` so a human decides what next.
5. **On timeout, network error, or anything ambiguous → leave `PENDING` and stop.**
   No status change, no retry. Reconciliation owns it now.
6. Audit every branch. Notify the fundraiser only on a confirmed `SUCCESS`.

**5c, reconciliation.** A job (cron route, hourly) that:

- Finds every `PENDING` transfer older than a few minutes, asks Chapa its
  outcome, and settles it. This is what makes step 5 above safe.
- Flags contradictions loudly, to the admin team-chat built earlier: a payout
  `PAID` with no successful transfer; a successful transfer whose payout is not
  `PAID`; any `PENDING` older than 24h.
- Produces a reconciliation view in the admin panel: our ledger beside Chapa's
  record, differences first.

A note on ordering: reconciliation is written **with** 5b, not after it. Shipping
the send path without it means the first ambiguous failure has to be untangled by
hand against a live bank.

## 6. Three decisions I need from you

1. **Who triggers a transfer?** An admin clicking "Send transfer" (my
   recommendation — keeps a human between a request and money leaving), or
   automatically as soon as a payout is approved?
2. **Is there a per-transfer ceiling above which it must stay manual?** A cap
   means a bug costs the cap, not the balance. `PlatformSettings` already holds
   `autoApproveMaxEtb`, so there is a natural home for it.
3. **How does a fundraiser learn it failed?** Silent (admin handles it), or an
   automatic message? They have a messages inbox already.

## 7. Testing, and how this gets switched on

- Integration tests against the local database (as `lib/payouts.integration.test.ts`
  does now) for the state machine: success, clear failure, and above all
  **timeout leaves PENDING and does not send twice**.
- Chapa stubbed by injecting the fetch layer — no test may ever contact the real
  API. Same rule as `lib/payouts.integration.test.ts`: refuse to run against
  anything but a local database.
- A reconciliation test where the ledger and the provider disagree, asserting the
  mismatch is reported rather than silently "fixed".

Rollout: merge with `CHAPA_TRANSFERS_ENABLED=false` → verify against Chapa's test
mode → enable for one real payout, watched, with reconciliation running → then
generally. **I will not flip that flag; that is the owner's call, on a real
account, with real money.**

## 8. Honest estimate

5a is straightforward. 5b and 5c are the work, and most of it is the unhappy
paths. This is the largest phase by some distance, and the only one where a bug
cannot be fixed by deploying again.

If a smaller step is wanted first, **5a alone is genuinely useful**: it gives
every payout a real transfer record and a place to put the truth, without
changing who moves money.
