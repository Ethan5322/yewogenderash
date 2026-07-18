import { db } from "@/lib/db";

/**
 * Append-only audit trail. Never throws — an audit failure must not break
 * the user-facing action, but it is logged loudly for ops.
 */
export async function writeAudit(entry: {
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  detail?: Record<string, unknown>;
  ipAddress?: string | null;
}) {
  try {
    await db.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        detail: entry.detail as object | undefined,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] FAILED to write audit log:", entry.action, err);
  }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}
