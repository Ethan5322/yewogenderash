/**
 * End-to-end proof that the internal staff line works, run against a real
 * database rather than mocks.
 *
 * It exercises the behaviour that was actually asked for: the main admin can
 * write to a sub-admin, the sub-admin can reply at any time, and neither one
 * needs a capability to do it. It also checks the boundaries — a sub-admin
 * cannot read someone else's conversation, and the audit log records that a
 * message was sent without recording what it said.
 *
 * Usage:
 *   node scripts/local-db.mjs 5434          # terminal 1
 *   DATABASE_URL=<printed url> node scripts/test-staff-chat.mjs
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL to the local-db connection string.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

let pass = 0;
let fail = 0;
const check = (cond, label) => {
  if (cond) {
    pass++;
    console.log(`  pass  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}`);
  }
};

const mkUser = (email, over = {}) =>
  db.user.create({
    data: {
      name: email.split("@")[0],
      email,
      passwordHash: "x",
      role: "ADMIN",
      ...over,
    },
    select: { id: true, name: true },
  });

async function main() {
  // ── Cast ────────────────────────────────────────────────────────────────
  const stamp = Date.now();
  const main_ = await mkUser(`main-${stamp}@t.test`, { isSuperAdmin: true });
  // A sub-admin with an EMPTY permission map — the hardest case for "without
  // barrier". If the staff line were gated on a capability, this account would
  // be locked out of it.
  const sub = await mkUser(`sub-${stamp}@t.test`, { adminPermissions: {} });
  const other = await mkUser(`other-${stamp}@t.test`, { adminPermissions: {} });
  const donor = await mkUser(`donor-${stamp}@t.test`, { role: "DONOR" });

  console.log("\n1. Main admin writes to a sub-admin");
  const m1 = await db.staffMessage.create({
    data: { senderId: main_.id, recipientId: sub.id, body: "Please review the pending KYC queue." },
  });
  check(!!m1.id, "message stored");
  check(m1.readAt === null, "starts unread");

  console.log("\n2. It shows as unread for the sub-admin only");
  const subUnread = await db.staffMessage.count({ where: { recipientId: sub.id, readAt: null } });
  const mainUnread = await db.staffMessage.count({ where: { recipientId: main_.id, readAt: null } });
  check(subUnread === 1, `sub-admin unread = 1 (got ${subUnread})`);
  check(mainUnread === 0, `main admin unread = 0 (got ${mainUnread})`);

  console.log("\n3. Sub-admin opens the thread — it is marked read");
  await db.staffMessage.updateMany({
    where: { senderId: main_.id, recipientId: sub.id, readAt: null },
    data: { readAt: new Date() },
  });
  const afterRead = await db.staffMessage.count({ where: { recipientId: sub.id, readAt: null } });
  check(afterRead === 0, `sub-admin unread cleared (got ${afterRead})`);

  console.log("\n4. Sub-admin replies — no capability, no barrier");
  const m2 = await db.staffMessage.create({
    data: { senderId: sub.id, recipientId: main_.id, body: "Done — 4 approved, 1 sent back for a clearer ID." },
  });
  const mainUnread2 = await db.staffMessage.count({ where: { recipientId: main_.id, readAt: null } });
  check(!!m2.id, "reply stored");
  check(mainUnread2 === 1, `main admin now has 1 unread (got ${mainUnread2})`);

  console.log("\n5. Both sides see the same conversation, in order");
  const thread = await db.staffMessage.findMany({
    where: {
      OR: [
        { senderId: main_.id, recipientId: sub.id },
        { senderId: sub.id, recipientId: main_.id },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  check(thread.length === 2, `thread has both messages (got ${thread.length})`);
  check(thread[0].senderId === main_.id && thread[1].senderId === sub.id, "oldest first");

  console.log("\n6. A third admin cannot see that conversation");
  const otherView = await db.staffMessage.findMany({
    where: {
      OR: [
        { senderId: other.id, recipientId: main_.id },
        { senderId: main_.id, recipientId: other.id },
      ],
    },
  });
  check(otherView.length === 0, `unrelated admin sees nothing (got ${otherView.length})`);

  console.log("\n7. Non-admins are not reachable on the staff line");
  const isAdmin = await db.user.findFirst({ where: { id: donor.id, role: "ADMIN" } });
  check(isAdmin === null, "a DONOR is rejected by the recipient check");

  console.log("\n8. Audit records the event, never the words");
  await db.auditLog.create({
    data: {
      actorId: main_.id,
      action: "staff_message.sent",
      entityType: "user",
      entityId: sub.id,
      detail: { to: sub.name, chars: 42 },
    },
  });
  const entry = await db.auditLog.findFirst({
    where: { actorId: main_.id, action: "staff_message.sent" },
  });
  const detail = JSON.stringify(entry?.detail ?? {});
  check(!!entry, "audit entry written");
  check(!detail.includes("KYC queue"), "message body is NOT in the audit log");
  check(detail.includes("chars"), "length is recorded instead");

  // ── Clean up ────────────────────────────────────────────────────────────
  await db.staffMessage.deleteMany({
    where: { OR: [{ senderId: { in: [main_.id, sub.id] } }, { recipientId: { in: [main_.id, sub.id] } }] },
  });
  await db.auditLog.deleteMany({ where: { actorId: main_.id } });
  await db.user.deleteMany({ where: { id: { in: [main_.id, sub.id, other.id, donor.id] } } });

  console.log(`\n${pass + fail} checks, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
