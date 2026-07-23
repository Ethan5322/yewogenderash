import QRCode from "qrcode";
import { appUrl } from "@/lib/env";

/**
 * PNG QR codes for the two entry points:
 *   ?target=site  → the public site homepage (for posters / sharing)
 *   ?target=admin → the admin sign-in (/admin-login), for staff
 * Add &download=1 for an attachment.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("target") === "admin" ? "admin" : "site";
  const download = searchParams.has("download");

  const base = appUrl();
  const url = target === "admin" ? `${base}/admin-login` : base;

  const png = await QRCode.toBuffer(url, {
    type: "png",
    width: 640,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#0b1620", light: "#ffffff" },
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "content-disposition": `${download ? "attachment" : "inline"}; filename="yewogen-${target}-qr.png"`,
      "cache-control": "public, max-age=86400",
    },
  });
}
