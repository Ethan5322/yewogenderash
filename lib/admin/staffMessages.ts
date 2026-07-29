import "server-only";
import { db } from "@/lib/db";

/**
 * The internal staff line — private one-to-one messages between admins.
 *
 * Separate from lib/messages.ts, which is the FUNDRAISER line. That one is
 * gated behind the `messages` capability; this one is open to every admin,
 * because a sub-admin who only holds `kyc` must still be able to answer the
 * main admin. Nothing here takes a permission argument, and that is deliberate:
 * there is no capability that can switch the staff line off for someone.
 *
 * The only access rule is participation — you see a thread if you are one of
 * its two people. Every query below is scoped by the caller's own id, so a
 * thread id alone is never enough to read someone else's conversation.
 */

/** One admin who can be messaged. */
export type StaffPeer = {
  id: string;
  name: string;
  email: string;
  adminCode: string | null;
  isSuperAdmin: boolean;
};

/** A row in the conversation list. */
export type StaffThread = StaffPeer & {
  lastBody: string | null;
  lastAt: Date | null;
  /** Messages from this peer that I have not read. */
  unread: number;
};

/** A single message in a thread, from the reader's point of view. */
export type StaffMessageView = {
  id: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
  /** True when the reader wrote it. */
  mine: boolean;
};

/** Every other admin, so anyone can start a thread with anyone. */
export async function listStaffPeers(meId: string): Promise<StaffPeer[]> {
  const rows = await db.user.findMany({
    where: { role: "ADMIN", isBanned: false, id: { not: meId } },
    select: { id: true, name: true, email: true, adminCode: true, isSuperAdmin: true },
    // Main admin first, then alphabetical — the person you most often need is
    // top of the list rather than wherever the alphabet puts them.
    orderBy: [{ isSuperAdmin: "desc" }, { name: "asc" }],
  });
  return rows;
}

/**
 * The conversation list: every other admin, each with their last message and
 * my unread count. Peers with no history are included so a first message can
 * always be started.
 */
export async function listStaffThreads(meId: string): Promise<StaffThread[]> {
  const peers = await listStaffPeers(meId);
  if (peers.length === 0) return [];

  const peerIds = peers.map((p) => p.id);

  // Every message between me and any of them, newest first. One query rather
  // than one per peer: an admin team is small, but N+1 on a page that renders
  // on every navigation is a habit worth not forming.
  const rows = await db.staffMessage.findMany({
    where: {
      OR: [
        { senderId: meId, recipientId: { in: peerIds } },
        { recipientId: meId, senderId: { in: peerIds } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      senderId: true,
      recipientId: true,
      body: true,
      readAt: true,
      createdAt: true,
    },
  });

  const byPeer = new Map<string, { lastBody: string; lastAt: Date; unread: number }>();
  for (const m of rows) {
    const peerId = m.senderId === meId ? m.recipientId : m.senderId;
    const entry = byPeer.get(peerId);
    // Rows arrive newest-first, so the first one seen for a peer is the latest.
    if (!entry) {
      byPeer.set(peerId, { lastBody: m.body, lastAt: m.createdAt, unread: 0 });
    }
    if (m.recipientId === meId && m.readAt === null) {
      byPeer.get(peerId)!.unread += 1;
    }
  }

  return peers.map((p) => {
    const e = byPeer.get(p.id);
    return {
      ...p,
      lastBody: e?.lastBody ?? null,
      lastAt: e?.lastAt ?? null,
      unread: e?.unread ?? 0,
    };
  });
}

/** Total unread staff messages addressed to me — the sidebar badge. */
export function staffUnreadTotal(meId: string): Promise<number> {
  return db.staffMessage.count({ where: { recipientId: meId, readAt: null } });
}

/**
 * One thread, oldest first, and marks the peer's messages to me as read.
 *
 * Scoped by both ids, so passing someone else's peer id returns that peer's
 * conversation with ME — never a conversation between two other people.
 * Returns null when the peer is not an admin.
 */
export async function getStaffThread(meId: string, peerId: string) {
  if (peerId === meId) return null;

  const peer = await db.user.findFirst({
    where: { id: peerId, role: "ADMIN" },
    select: { id: true, name: true, email: true, adminCode: true, isSuperAdmin: true },
  });
  if (!peer) return null;

  const rows = await db.staffMessage.findMany({
    where: {
      OR: [
        { senderId: meId, recipientId: peerId },
        { senderId: peerId, recipientId: meId },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, senderId: true, body: true, readAt: true, createdAt: true },
  });

  await db.staffMessage.updateMany({
    where: { senderId: peerId, recipientId: meId, readAt: null },
    data: { readAt: new Date() },
  });

  const messages: StaffMessageView[] = rows.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt,
    readAt: m.readAt,
    mine: m.senderId === meId,
  }));

  return { peer, messages };
}

/**
 * Send a message. Returns null if the recipient is not an admin, so a tampered
 * form cannot post into a donor's or fundraiser's records.
 */
export async function sendStaffMessage(meId: string, peerId: string, body: string) {
  const text = body.trim();
  if (!text || peerId === meId) return null;

  const peer = await db.user.findFirst({
    where: { id: peerId, role: "ADMIN" },
    select: { id: true, name: true },
  });
  if (!peer) return null;

  const created = await db.staffMessage.create({
    data: { senderId: meId, recipientId: peerId, body: text.slice(0, 4000) },
    select: { id: true, createdAt: true },
  });

  return { ...created, peerName: peer.name, chars: text.length };
}
