import "server-only";
import { db } from "@/lib/db";

/**
 * Messaging between fundraisers and the admin team.
 *
 * A fundraiser's thread = their direct messages (both directions) plus every
 * admin broadcast notice. Broadcasts are a single shared row (ownerId null),
 * so per-owner read state is only tracked for DIRECT admin→owner messages.
 */

/** An owner's thread: their direct messages + all broadcast notices, oldest first. */
export function getOwnerMessages(ownerId: string) {
  return db.message.findMany({
    where: { OR: [{ ownerId, isBroadcast: false }, { isBroadcast: true }] },
    orderBy: { createdAt: "asc" },
  });
}

/** Count of unread admin→owner direct messages for this owner. */
export function ownerUnreadCount(ownerId: string) {
  return db.message.count({
    where: { ownerId, fromAdmin: true, isBroadcast: false, readByOwner: false },
  });
}

/** Mark this owner's inbound (admin→owner) messages as read. */
export async function markOwnerThreadRead(ownerId: string) {
  await db.message.updateMany({
    where: { ownerId, fromAdmin: true, readByOwner: false },
    data: { readByOwner: true },
  });
}

export type AdminThread = {
  ownerId: string;
  name: string;
  authorCode: string | null;
  lastBody: string;
  lastAt: Date;
  unread: number;
};

/** One row per fundraiser who has any direct message, newest activity first. */
export async function listAdminThreads(): Promise<AdminThread[]> {
  const rows = await db.message.findMany({
    where: { ownerId: { not: null }, isBroadcast: false },
    orderBy: { createdAt: "desc" },
    select: {
      ownerId: true,
      body: true,
      fromAdmin: true,
      readByAdmin: true,
      createdAt: true,
      owner: { select: { authorCode: true, user: { select: { name: true } } } },
    },
  });

  const threads = new Map<string, AdminThread>();
  for (const m of rows) {
    if (!m.ownerId) continue;
    if (!threads.has(m.ownerId)) {
      threads.set(m.ownerId, {
        ownerId: m.ownerId,
        name: m.owner?.user.name ?? "Unknown",
        authorCode: m.owner?.authorCode ?? null,
        lastBody: m.body,
        lastAt: m.createdAt,
        unread: 0,
      });
    }
    if (!m.fromAdmin && !m.readByAdmin) {
      const t = threads.get(m.ownerId)!;
      t.unread += 1;
    }
  }
  return [...threads.values()];
}

/** Total unread owner→admin messages across all threads (for the nav badge). */
export function adminUnreadTotal() {
  return db.message.count({
    where: { fromAdmin: false, isBroadcast: false, readByAdmin: false },
  });
}

/** A single owner's thread for the admin, oldest first; marks inbound read. */
export async function getAdminThread(ownerId: string) {
  const owner = await db.campaignOwner.findUnique({
    where: { id: ownerId },
    select: { id: true, authorCode: true, user: { select: { name: true, email: true } } },
  });
  if (!owner) return null;

  const messages = await db.message.findMany({
    where: { ownerId, isBroadcast: false },
    orderBy: { createdAt: "asc" },
  });

  await db.message.updateMany({
    where: { ownerId, fromAdmin: false, readByAdmin: false },
    data: { readByAdmin: true },
  });

  return { owner, messages };
}
