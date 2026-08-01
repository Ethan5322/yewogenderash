import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { isActiveAdmin } from "@/lib/admin/active-admin";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { PUBLIC_STATUSES } from "@/lib/campaigns";

/**
 * PNG QR code for a campaign's quick-donate URL. The QR encodes
 * `<app>/q/<queryCode>` — one campaign, one code, one destination.
 *
 * Public campaigns: anyone may fetch (posters, sharing).
 * Draft/pending campaigns: only the owning user or an admin — a QR for an
 * unreviewed campaign must not circulate as if it were live.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ queryCode: string }> }
) {
  const { queryCode } = await params;
  const download = new URL(req.url).searchParams.has("download");

  const campaign = await db.campaign.findUnique({
    where: { queryCode },
    select: {
      status: true,
      queryCodeActive: true,
      owner: { select: { userId: true } },
    },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isPublic = PUBLIC_STATUSES.includes(campaign.status) && campaign.queryCodeActive;
  if (!isPublic) {
    // Disabled or unreviewed codes: only the owner or an admin may still render
    // the QR (e.g. to print/download it) — it must not circulate publicly.
    const session = await auth();
    const isOwner = session?.user?.id === campaign.owner.userId;
    // Fresh DB read rather than the JWT's role claim — a demoted admin's 7-day
    // token must not keep rendering QR codes for suspended or unreviewed
    // campaigns. Ownership is safe to take from the session id: that identifies
    // the account, it does not assert a privilege.
    const isAdmin = await isActiveAdmin(session?.user?.id);
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const png = await QRCode.toBuffer(`${appUrl()}/q/${queryCode}`, {
    type: "png",
    width: 600,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#0b1620", light: "#ffffff" },
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "content-disposition": `${download ? "attachment" : "inline"}; filename="yewogen-${queryCode}.png"`,
      // Public QRs are immutable per code; private ones must not be cached.
      "cache-control": isPublic ? "public, max-age=86400" : "private, no-store",
    },
  });
}
