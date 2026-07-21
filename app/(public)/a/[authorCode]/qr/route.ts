import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";

/**
 * PNG QR code for an owner's Author ID. Encodes `<app>/a/<authorCode>` — scan
 * it (e.g. an admin verifying an owner) to open the author profile. Author
 * codes only exist for admin-verified owners, so the QR is public.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ authorCode: string }> }
) {
  const { authorCode } = await params;

  const owner = await db.campaignOwner.findUnique({
    where: { authorCode },
    select: { id: true },
  });
  if (!owner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const png = await QRCode.toBuffer(`${appUrl()}/a/${authorCode}`, {
    type: "png",
    width: 600,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#0b1620", light: "#ffffff" },
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "content-disposition": `inline; filename="author-${authorCode}.png"`,
      "cache-control": "public, max-age=86400",
    },
  });
}
