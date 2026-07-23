// Corporate Fundraiser ID card generator (browser/canvas only).
//
// Same single-sided CR80 (85.6×54 mm) layout and arrangement as the Yoyo GYM
// member ID — obsidian body, accent racing stripe in the header, gold inset
// frame + diamond corners, passport photo, scan-to-verify QR, holder details,
// a Code128 verification barcode, and the MuleSoo "Designed & Built" agency
// credit — but in Yewogen Derash's own (green) colour and with fundraiser data.
//
// Renders to a high-resolution canvas (3× ≈ 3036×1914 px) and downloads as a
// crisp PNG or a print-ready PDF at exact card size.
import { code128Modules } from "@/lib/barcode";
import { jpegToPdfBlob } from "@/lib/id-card/jpeg-pdf";
import { BRAND_HAND_PATHS, BRAND_HEART_PATH } from "@/lib/brand";

export type IdCardField = { label: string; value: string };
export type IdCardData = {
  org: string;
  subtitle: string;
  roleLabel: string;
  name: string;
  verificationCode: string;
  photoUrl: string;
  qrUrl: string;
  issued: string;
  status: string;
  fields: IdCardField[];
  accent?: string;
};

// Canvas design space — 1012×638 matches the CR80 ratio (85.6/54 ≈ 1.586).
const W = 1012;
const H = 638;
const CARD_W_MM = 85.6;
const CARD_H_MM = 54;

const INK = "#0A0A0A";
const GOLD = "#C8922A";
const PAPER = "#F0EDE8";
const MUTED = "#8A8580";
const ACCENT_DEFAULT = "#12a05f"; // Yewogen Derash green

const HEADER_H = 120;
const MULESOO_CREDIT_SRC = "/brand/mulesoo-credit-on-dark.png";
const MULESOO_CREDIT_ASPECT = 4.25;

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ir = img.width / img.height;
  const r = w / h;
  let sw = img.width;
  let sh = img.height;
  if (ir > r) sw = img.height * r;
  else sh = img.width / r;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  let t = String(text ?? "");
  if (ctx.measureText(t).width <= maxWidth) return t;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/** Draw a Code128 barcode into the context, scaled to fit `width` with a quiet zone. */
function drawBarcode(
  ctx: CanvasRenderingContext2D,
  value: string,
  { x, y, width, height, quietZone = 8 }: { x: number; y: number; width: number; height: number; quietZone?: number }
) {
  const bits = code128Modules(value);
  const drawable = width - quietZone * 2;
  const module = drawable / bits.length;
  ctx.save();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "#000000";
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== "1") continue;
    ctx.fillRect(x + quietZone + i * module, y, module + 0.5, height);
  }
  ctx.restore();
}

/** The brand mark — a heart cradled in open hands — drawn on the canvas. */
function drawLogoMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  handColor: string,
  heartColor: string
) {
  const scale = size / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = heartColor;
  ctx.fill(new Path2D(BRAND_HEART_PATH));
  ctx.fillStyle = handColor;
  for (const d of BRAND_HAND_PATHS) ctx.fill(new Path2D(d));
  ctx.restore();
}

/** Obsidian body: accent header flourish (clipped to header), gold frame, corners. */
function drawShell(ctx: CanvasRenderingContext2D, accent: string) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, HEADER_H);
  ctx.clip();
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(W * 0.62, -20);
  ctx.lineTo(W * 0.72, -20);
  ctx.lineTo(W * 0.5, HEADER_H + 20);
  ctx.lineTo(W * 0.4, HEADER_H + 20);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(W * 0.75, -20);
  ctx.lineTo(W * 0.8, -20);
  ctx.lineTo(W * 0.58, HEADER_H + 20);
  ctx.lineTo(W * 0.53, HEADER_H + 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(40, HEADER_H);
  ctx.lineTo(W - 40, HEADER_H);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = GOLD;
  ctx.font = "22px serif";
  ctx.fillText("◆", 30, 50);
  ctx.fillText("◆", W - 50, 50);
  ctx.fillText("◆", 30, H - 32);
  ctx.fillText("◆", W - 50, H - 32);
}

async function drawCard(ctx: CanvasRenderingContext2D, o: IdCardData) {
  const accent = o.accent ?? ACCENT_DEFAULT;
  drawShell(ctx, accent);

  // Header — brand mark (white shield + accent heart) then wordmark
  drawLogoMark(ctx, 52, 40, 58, "#FFFFFF", GOLD);
  ctx.fillStyle = accent;
  ctx.font = "700 46px Oswald, Arial, sans-serif";
  ctx.fillText(fit(ctx, o.org.toUpperCase(), 540), 124, 88);
  ctx.fillStyle = MUTED;
  ctx.font = "600 14px Oswald, Arial, sans-serif";
  ctx.fillText(o.subtitle.toUpperCase(), 126, 112);

  // QR (top-right, white quiet zone)
  if (o.qrUrl) {
    const QRCode = (await import("qrcode")).default;
    const qz = 136;
    const qx = W - qz - 60;
    const qy = 132;
    const qrData = await QRCode.toDataURL(o.qrUrl, { margin: 1, width: 320, errorCorrectionLevel: "H" });
    const qimg = await loadImg(qrData);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(qx - 8, qy - 8, qz + 16, qz + 16);
    if (qimg) ctx.drawImage(qimg, qx, qy, qz, qz);
    ctx.fillStyle = MUTED;
    ctx.font = "500 12px Oswald, Arial, sans-serif";
    ctx.fillText("SCAN TO VERIFY", qx + 14, qy + qz + 26);
  }

  // Photo (passport 3:4) with gold frame
  const px = 56;
  const py = 130;
  const pw = 210;
  const ph = 258;
  const photo = await loadImg(o.photoUrl);
  ctx.fillStyle = "#1A1A1A";
  ctx.fillRect(px, py, pw, ph);
  if (photo) {
    drawCover(ctx, photo, px, py, pw, ph);
  } else {
    ctx.fillStyle = MUTED;
    ctx.font = "500 15px Oswald, Arial, sans-serif";
    ctx.fillText("NO PHOTO", px + 56, py + ph / 2);
  }
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);

  // Primary details beside the photo
  const dx = px + pw + 36;
  const dw = W - dx - 220;
  ctx.fillStyle = MUTED;
  ctx.font = "600 14px Oswald, Arial, sans-serif";
  ctx.fillText(o.roleLabel.toUpperCase(), dx, 154);
  ctx.fillStyle = PAPER;
  ctx.font = "700 40px Oswald, Arial, sans-serif";
  ctx.fillText(fit(ctx, o.name.toUpperCase(), dw), dx, 194);

  ctx.fillStyle = MUTED;
  ctx.font = "600 12px Oswald, Arial, sans-serif";
  ctx.fillText("VERIFICATION CODE", dx, 226);
  ctx.fillStyle = accent;
  ctx.font = "500 27px 'Courier New', monospace";
  ctx.fillText(o.verificationCode, dx, 254);

  // Status badge (gold)
  const label = (o.status || "").toUpperCase();
  if (label) {
    ctx.font = "700 16px Oswald, Arial, sans-serif";
    const tw = ctx.measureText(label).width + 24;
    ctx.fillStyle = GOLD;
    ctx.fillRect(dx, 272, tw, 30);
    ctx.fillStyle = INK;
    ctx.fillText(label, dx + 12, 293);
  }

  ctx.fillStyle = MUTED;
  ctx.font = "600 12px Oswald, Arial, sans-serif";
  ctx.fillText("ISSUED", dx, 330);
  ctx.fillStyle = PAPER;
  ctx.font = "500 20px 'Courier New', monospace";
  ctx.fillText(o.issued || "—", dx, 356);

  // Holder detail grid
  const fields = (o.fields || []).filter((f) => f && f.value);
  if (fields.length) {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(56, 398);
    ctx.lineTo(W - 56, 398);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const colX = [56, 372, 688];
    const colW = 280;
    fields.slice(0, 6).forEach((f, i) => {
      const x = colX[i % 3];
      const y = 424 + Math.floor(i / 3) * 40;
      ctx.fillStyle = MUTED;
      ctx.font = "600 11px Oswald, Arial, sans-serif";
      ctx.fillText(String(f.label).toUpperCase(), x, y);
      ctx.fillStyle = PAPER;
      ctx.font = "500 17px 'Courier New', monospace";
      ctx.fillText(fit(ctx, f.value, colW), x, y + 20);
    });
  }

  // Footer: verification barcode (left)
  const footY = 522;
  if (o.verificationCode) {
    ctx.fillStyle = MUTED;
    ctx.font = "600 11px Oswald, Arial, sans-serif";
    ctx.fillText("VERIFICATION CODE", 56, footY);
    const bx = 64;
    const bw = 360;
    const bh = 40;
    const by = footY + 12;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(bx - 8, by - 6, bw + 16, bh + 34);
    try {
      drawBarcode(ctx, o.verificationCode, { x: bx, y: by, width: bw, height: bh, quietZone: 8 });
    } catch {
      /* code outside Code128-B — text below still identifies it */
    }
    ctx.fillStyle = INK;
    ctx.font = "600 16px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(o.verificationCode, bx + bw / 2, by + bh + 20);
    ctx.textAlign = "left";
  }

  // MuleSoo agency credit (footer-right) — image lockup, with a text fallback
  // that still reads "Designed & Built by MuleSoo Digital Services".
  const cx = 470;
  const creditW = Math.min(470, W - cx - 30);
  const creditH = creditW / MULESOO_CREDIT_ASPECT;
  const creditY = Math.min(footY - 6, H - creditH - 14);
  const credit = await loadImg(MULESOO_CREDIT_SRC);
  if (credit) {
    ctx.drawImage(credit, cx, creditY, creditW, creditH);
  } else {
    ctx.fillStyle = MUTED;
    ctx.font = "600 10px Oswald, Arial, sans-serif";
    ctx.fillText("DESIGNED & BUILT BY", cx, footY);
    ctx.fillStyle = GOLD;
    ctx.font = "700 16px Oswald, Arial, sans-serif";
    ctx.fillText("MULESOO DIGITAL SERVICES", cx, footY + 23);
    ctx.fillStyle = PAPER;
    ctx.font = "500 13px 'Courier New', monospace";
    ctx.fillText("mulesoo.com  |  hello@mulesoo.com", cx, footY + 45);
  }
}

async function fontsReady() {
  try {
    await (document.fonts?.ready ?? Promise.resolve());
  } catch {
    /* ignore */
  }
}

/** Render the card to a high-resolution canvas (`scale`× pixel density). */
export async function renderIdCardCanvas(o: IdCardData, scale = 3): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  await fontsReady();
  await drawCard(ctx, o);
  return canvas;
}

const fileBase = (o: IdCardData) =>
  `yewogen-id-${(o.verificationCode || o.name || "fundraiser").replace(/\s+/g, "-")}`;

/** Download the ID card as a high-resolution PNG. */
export async function downloadIdCardPng(o: IdCardData) {
  const canvas = await renderIdCardCanvas(o, 3);
  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${fileBase(o)}.png`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 2000);
      }
      resolve();
    }, "image/png");
  });
}

/** Download the ID card as a print-ready PDF at exact CR80 size (85.6×54 mm). */
export async function downloadIdCardPdf(o: IdCardData) {
  const canvas = await renderIdCardCanvas(o, 3);
  const jpegBlob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode the card."))),
      "image/jpeg",
      0.95
    )
  );
  const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());
  const pdf = jpegToPdfBlob(jpeg, canvas.width, canvas.height, CARD_W_MM, CARD_H_MM);

  const url = URL.createObjectURL(pdf);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase(o)}.pdf`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}
