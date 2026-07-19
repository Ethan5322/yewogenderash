import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { auth } from "@/auth";
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
  _req: Request,
  { params }: { params: Promise<{ queryCode: string }> }
) {
  const { queryCode } = await params;

  const campaign = await db.campaign.findUnique({
    where: { queryCode },
    select: {
      status: true,
      owner: { select: { userId: true } },
    },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isPublic = PUBLIC_STATUSES.includes(campaign.status);
  if (!isPublic) {
    const session = await auth();
    const isOwner = session?.user?.id === campaign.owner.userId;
    const isAdmin = session?.user?.role === "ADMIN";
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
      "content-disposition": `inline; filename="yewogen-${queryCode}.png"`,
      // Public QRs are immutable per code; private ones must not be cached.
      "cache-control": isPublic ? "public, max-age=86400" : "private, no-store",
    },
  });
}
