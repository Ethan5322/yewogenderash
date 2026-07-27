// Yewogen Derash ID card generator (browser/canvas only).
//
// An original design, not a restyle of anyone else's card. It is built to read
// as a VERIFICATION CREDENTIAL rather than a membership card, using motifs
// borrowed from identity documents and banknotes:
//
//   - a brand-green header carrying a guilloché wave lattice (the interference
//     pattern used on passports and banknotes) instead of a graphic stripe,
//   - the platform's promise printed on the card — identity-checked, tracked,
//     audited — with the site address, so the card states the trust it claims,
//   - a struck verification seal with ring text around the holder's status,
//   - registration-style corner brackets on the portrait and the card edge,
//   - a repeating microtext security strip down the left edge,
//   - a ghosted brand watermark behind the holder details,
//   - the verification zone (QR + barcode) grouped together in a footer band,
//     so everything a verifier scans sits in one place.
//
// Colours are the site's own brand tokens, and the type is the site's display
// font, so the card and the website read as one system. The MuleSoo agency
// credit stays in the footer.
//
// Renders to a high-resolution canvas (3× ≈ 3036×1914 px) and downloads as a
// crisp PNG or a print-ready PDF at exact CR80 size.
import { code128Modules } from "@/lib/barcode";
import { jpegToPdfBlob } from "@/lib/id-card/jpeg-pdf";
import { BRAND_HAND_PATHS, BRAND_HEART_PATH, BRAND_GOLD, BRAND_GREEN } from "@/lib/brand";

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

// Brand tokens (see lib/brand.ts and the public-site palette).
const INK = "#0B1620"; // card body
const INK_PANEL = "#132430"; // portrait + footer panels
const GOLD = BRAND_GOLD;
const PAPER = "#F7FAF8";
const MUTED = "#8FA3AD";
const ACCENT_DEFAULT = BRAND_GREEN;

const HEADER_H = 104;
const FOOTER_Y = 500;
const SITE = "yewogenderash.com";
const PROMISE = "IDENTITY-CHECKED · TRACKED · AUDITED";
const MULESOO_CREDIT_SRC = "/brand/mulesoo-credit-on-dark.png";
const MULESOO_CREDIT_ASPECT = 4.25;

/**
 * The site's own display font. next/font generates a hashed family name and
 * publishes it as a CSS variable, so read it off the document rather than
 * guessing; fall back to a sensible stack when it isn't available (SSR, tests).
 */
function siteFont(): string {
  try {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-jakarta")
      .trim();
    if (v) return `${v}, "Segoe UI", Arial, sans-serif`;
  } catch {
    /* fall through */
  }
  return '"Plus Jakarta Sans", "Segoe UI", Arial, sans-serif';
}
const MONO = '"Courier New", ui-monospace, monospace';

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

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
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

/** Letter-spaced small caps — used for every label on the card. */
function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing = 1.6
) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  return cx - x;
}

function trackedWidth(ctx: CanvasRenderingContext2D, text: string, spacing = 1.6): number {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  return w - spacing;
}

/** Rounded rectangle path, with a manual fallback for older engines. */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw a Code128 barcode, scaled to fit `width` with a quiet zone. */
function drawBarcode(
  ctx: CanvasRenderingContext2D,
  value: string,
  {
    x,
    y,
    width,
    height,
    quietZone = 8,
  }: { x: number; y: number; width: number; height: number; quietZone?: number }
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

/** The brand mark — a heart cradled in open hands. */
function drawLogoMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  handColor: string,
  heartColor: string,
  alpha = 1
) {
  const scale = size / 24;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = handColor;
  for (const d of BRAND_HAND_PATHS) ctx.fill(new Path2D(d));
  ctx.fillStyle = heartColor;
  ctx.fill(new Path2D(BRAND_HEART_PATH));
  ctx.restore();
}

/**
 * Guilloché lattice — interfering sine curves, the pattern engraved on
 * banknotes and passports. Cheap to draw, impossible to mistake for a stripe.
 */
function drawGuilloche(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  lines = 16
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < lines; i++) {
    const phase = i * 0.44;
    const amp = h * 0.3;
    ctx.beginPath();
    for (let px = 0; px <= w; px += 4) {
      const t = (px / w) * Math.PI * 5;
      const py =
        y + h / 2 + Math.sin(t + phase) * amp * Math.cos(t * 0.45 + phase * 0.8) + (i - lines / 2) * 3.2;
      if (px === 0) ctx.moveTo(x + px, py);
      else ctx.lineTo(x + px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Registration-style corner brackets (portrait frame and card edge). */
function drawBrackets(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  len: number,
  color: string,
  lineWidth = 3
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  // top-left
  ctx.moveTo(x, y + len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len, y);
  // top-right
  ctx.moveTo(x + w - len, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + len);
  // bottom-right
  ctx.moveTo(x + w, y + h - len);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w - len, y + h);
  // bottom-left
  ctx.moveTo(x + len, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + h - len);
  ctx.stroke();
  ctx.restore();
}

/** Text set around a circle, for the seal's ring. */
/**
 * Set text along a circular arc, one glyph at a time.
 *
 * `facing` is which way the tops of the letters point. Seal convention is that
 * the arc over the top reads with its letters' tops pointing "out" (away from
 * the centre), while the arc under the bottom reads with them pointing "in" —
 * that is what keeps both arcs readable left-to-right on an upright card.
 * Getting this wrong on the lower arc renders the word upside down, which reads
 * as mirrored ("VERIFIED" → "DEIFIREV").
 */
function ringText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
  font: string,
  color: string,
  facing: "out" | "in" = "out"
) {
  const chars = [...text];
  if (!chars.length) return;
  const step = (endAngle - startAngle) / chars.length;
  const turn = facing === "out" ? Math.PI / 2 : -Math.PI / 2;
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  chars.forEach((ch, i) => {
    const a = startAngle + step * i + step / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(a + turn);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

/**
 * The verification seal — a struck double ring carrying the platform name and
 * the holder's status, with a tick when the holder is verified.
 */
function drawSeal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  status: string,
  accent: string,
  font: string
) {
  const label = (status || "").toUpperCase();
  const verified = /VERIFIED|ACTIVE|STAFF/.test(label);
  const tone = verified ? GOLD : MUTED;

  // Everything scales off the radius. The seal was originally drawn at r=62 in
  // the holder block; it now sits in the footer at roughly two-thirds that, and
  // fixed ring offsets left the lettering cramped against the rings.
  const k = r / 62;
  const ringGap = 9 * k;
  const textRadius = r - 20 * k;
  const ringFont = `700 ${(11 * k).toFixed(1)}px ${font}`;

  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = tone;
  ctx.lineWidth = 2.5 * k;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.75, k);
  ctx.beginPath();
  ctx.arc(cx, cy, r - ringGap, 0, Math.PI * 2);
  ctx.stroke();

  ringText(ctx, "YEWOGEN DERASH", cx, cy, textRadius, Math.PI * 0.78, Math.PI * 2.22, ringFont, tone);
  ringText(
    ctx,
    label || "ISSUED",
    cx,
    cy,
    textRadius,
    Math.PI * 0.72,
    Math.PI * 0.28,
    ringFont,
    tone,
    "in"
  );

  // Tick (verified) or a neutral dot rule (pending).
  ctx.strokeStyle = verified ? accent : MUTED;
  ctx.lineWidth = 5 * k;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (verified) {
    ctx.beginPath();
    ctx.moveTo(cx - 15 * k, cy);
    ctx.lineTo(cx - 4 * k, cy + 11 * k);
    ctx.lineTo(cx + 16 * k, cy - 12 * k);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - 13 * k, cy);
    ctx.lineTo(cx + 13 * k, cy);
    ctx.stroke();
  }
  ctx.restore();
}

/** Repeating microtext strip — legible only at print resolution. */
function drawMicrotext(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  font: string
) {
  const unit = `${SITE.toUpperCase()} · VERIFIED · `;
  ctx.save();
  ctx.translate(x, y + height);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `600 7px ${font}`;
  ctx.fillStyle = MUTED;
  ctx.globalAlpha = 0.5;
  let text = "";
  while (ctx.measureText(text).width < height) text += unit;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Card body: header band, edge rules, watermark, microtext. */
function drawShell(ctx: CanvasRenderingContext2D, accent: string, o: IdCardData, font: string) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  // ── Header band: brand green, guilloché lattice, gold hairline ──
  const grad = ctx.createLinearGradient(0, 0, W, HEADER_H);
  grad.addColorStop(0, accent);
  grad.addColorStop(1, "#0A5C3A");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, HEADER_H);
  drawGuilloche(ctx, 0, 0, W, HEADER_H, "#FFFFFF", 13);
  // Double rule under the header — a hair of gold over a lighter thread.
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, HEADER_H - 2, W, 2);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(0, HEADER_H, W, 1);

  // ── Footer band ──
  ctx.fillStyle = INK_PANEL;
  ctx.fillRect(0, FOOTER_Y, W, H - FOOTER_Y);
  ctx.strokeStyle = GOLD;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, FOOTER_Y);
  ctx.lineTo(W, FOOTER_Y);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ── Ghosted brand watermark, set low-right so no text sits on it ──
  drawLogoMark(ctx, 690, 214, 300, "#FFFFFF", "#FFFFFF", 0.022);

  // ── One quiet gold rule inside the card edge (no busy corner marks) ──
  ctx.strokeStyle = GOLD;
  ctx.globalAlpha = 0.32;
  ctx.lineWidth = 1;
  ctx.strokeRect(16, 16, W - 32, H - 32);
  ctx.globalAlpha = 1;

  // ── Microtext security strip (left edge) ──
  drawMicrotext(ctx, 30, HEADER_H + 24, FOOTER_Y - HEADER_H - 48, font);
  void o;
}

async function drawCard(ctx: CanvasRenderingContext2D, o: IdCardData) {
  const accent = o.accent ?? ACCENT_DEFAULT;
  const font = siteFont();
  drawShell(ctx, accent, o, font);

  // ── Header content ────────────────────────────────────────────
  drawLogoMark(ctx, 48, 24, 56, "#FFFFFF", GOLD);
  ctx.fillStyle = PAPER;
  ctx.font = `700 34px ${font}`;
  tracked(ctx, fit(ctx, o.org.toUpperCase(), 440), 116, 56, 1.2);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = `600 11px ${font}`;
  tracked(ctx, o.subtitle.toUpperCase(), 117, 80, 2.2);

  // The promise the card makes — one quiet line, right-aligned.
  ctx.font = `600 11px ${font}`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  const pw = trackedWidth(ctx, PROMISE, 2.4);
  tracked(ctx, PROMISE, W - 48 - pw, 64, 2.4);

  // ── Portrait, bracketed like a document photo ─────────────────
  const px = 56;
  const py = 144;
  const pw2 = 192;
  const ph = 256;
  ctx.fillStyle = INK_PANEL;
  ctx.fillRect(px, py, pw2, ph);
  const photo = await loadImg(o.photoUrl);
  if (photo) {
    drawCover(ctx, photo, px, py, pw2, ph);
  } else {
    ctx.fillStyle = "#24404F";
    ctx.beginPath();
    ctx.arc(px + pw2 / 2, py + ph * 0.38, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px + pw2 / 2, py + ph * 0.92, 78, 60, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = MUTED;
    ctx.font = `600 12px ${font}`;
    const nl = trackedWidth(ctx, "NO PHOTO", 1.4);
    tracked(ctx, "NO PHOTO", px + pw2 / 2 - nl / 2, py + ph - 18, 1.4);
  }
  ctx.strokeStyle = "rgba(200,146,42,0.28)";
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, pw2, ph);
  drawBrackets(ctx, px - 7, py - 7, pw2 + 14, ph + 14, 18, GOLD, 2);

  // Issued date, tucked under the portrait.
  ctx.fillStyle = MUTED;
  ctx.font = `600 9px ${font}`;
  tracked(ctx, "ISSUED", px, py + ph + 34, 2);
  ctx.fillStyle = PAPER;
  ctx.font = `500 16px ${MONO}`;
  ctx.fillText(o.issued || "—", px, py + ph + 56);

  // ── Holder block ──────────────────────────────────────────────
  const dx = px + pw2 + 46;
  // Top-right slot beside the holder details. The QR sits here so the thing a
  // verifier actually scans is the most prominent mark on the card; the struck
  // seal moved down to the footer verification zone.
  const markCx = W - 122;
  const markCy = 224;
  const markR = 62;
  const dw = markCx - markR - dx - 26;

  ctx.fillStyle = accent;
  ctx.font = `700 10px ${font}`;
  tracked(ctx, o.roleLabel.toUpperCase(), dx, 168, 2.4);

  ctx.fillStyle = PAPER;
  ctx.font = `700 37px ${font}`;
  ctx.fillText(fit(ctx, o.name.toUpperCase(), dw), dx, 210);

  ctx.fillStyle = GOLD;
  ctx.fillRect(dx, 224, 56, 2);

  // Verification code — the card's primary key, set in a quiet framed panel.
  const boxY = 250;
  const boxH = 58;
  const boxW = Math.max(280, Math.min(dw, 330));
  ctx.strokeStyle = "rgba(15,122,77,0.45)";
  ctx.lineWidth = 1;
  roundRectPath(ctx, dx, boxY, boxW, boxH, 6);
  ctx.stroke();
  ctx.fillStyle = "rgba(15,122,77,0.09)";
  ctx.fill();
  ctx.fillStyle = MUTED;
  ctx.font = `600 9px ${font}`;
  tracked(ctx, "VERIFICATION CODE", dx + 16, boxY + 20, 2);
  ctx.fillStyle = accent;
  ctx.font = `700 24px ${MONO}`;
  ctx.fillText(fit(ctx, o.verificationCode, boxW - 32), dx + 16, boxY + 46);

  // Scan-to-verify QR, in the prominent top-right slot.
  if (o.qrUrl) {
    const QRCode = (await import("qrcode")).default;
    const qrData = await QRCode.toDataURL(o.qrUrl, {
      margin: 1,
      width: 360,
      errorCorrectionLevel: "H",
    });
    const qimg = await loadImg(qrData);
    const qSize = markR * 2;
    const qLeft = markCx - markR;
    const qTop = markCy - markR;
    ctx.fillStyle = "#FFFFFF";
    roundRectPath(ctx, qLeft - 6, qTop - 6, qSize + 12, qSize + 12, 6);
    ctx.fill();
    if (qimg) ctx.drawImage(qimg, qLeft, qTop, qSize, qSize);
    ctx.fillStyle = GOLD;
    ctx.font = `600 9px ${font}`;
    const sw = trackedWidth(ctx, "SCAN TO VERIFY", 1.6);
    tracked(ctx, "SCAN TO VERIFY", markCx - sw / 2, qTop + qSize + 22, 1.6);
  }

  // ── Holder detail grid ────────────────────────────────────────
  const fields = (o.fields || []).filter((f) => f && f.value);
  if (fields.length) {
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dx, 344);
    ctx.lineTo(W - 56, 344);
    ctx.stroke();

    const colW = (W - 56 - dx) / 3;
    fields.slice(0, 6).forEach((f, i) => {
      const x = dx + (i % 3) * colW;
      const y = 376 + Math.floor(i / 3) * 46;
      ctx.fillStyle = MUTED;
      ctx.font = `600 9px ${font}`;
      tracked(ctx, String(f.label).toUpperCase(), x, y, 1.8);
      ctx.fillStyle = PAPER;
      ctx.font = `500 15px ${MONO}`;
      ctx.fillText(fit(ctx, f.value, colW - 22), x, y + 22);
    });
  }

  // ── Footer: the verification zone (seal + barcode) then the credit ──
  const qz = 82;
  const qx = 56;
  const qy = FOOTER_Y + 22;
  // The struck seal now anchors the footer, where the QR used to sit.
  drawSeal(ctx, qx + qz / 2, qy + qz / 2 + 4, qz / 2 + 8, o.status, accent, font);

  if (o.verificationCode) {
    const bx = qx + qz + 32;
    // Wider and taller than before so it scans reliably off a printed card.
    const bw = 330;
    const bh = 50;
    const by = qy - 2;
    ctx.fillStyle = "#FFFFFF";
    roundRectPath(ctx, bx - 7, by - 5, bw + 14, bh + 10, 4);
    ctx.fill();
    try {
      drawBarcode(ctx, o.verificationCode, { x: bx, y: by, width: bw, height: bh, quietZone: 8 });
    } catch {
      /* code outside Code128-B — the text below still identifies it */
    }
    // Code and the address to check it against, set on the dark panel.
    ctx.fillStyle = PAPER;
    ctx.font = `500 13px ${MONO}`;
    ctx.fillText(o.verificationCode, bx - 7, by + bh + 26);
    ctx.fillStyle = GOLD;
    ctx.font = `600 9px ${font}`;
    tracked(ctx, `SCAN OR VERIFY AT ${SITE.toUpperCase()}`, bx - 7, by + bh + 46, 1.8);
  }

  // MuleSoo agency credit (footer-right) — image lockup, text fallback.
  const cx = 712;
  const creditW = Math.min(244, W - cx - 56);
  const creditH = creditW / MULESOO_CREDIT_ASPECT;
  const creditY = FOOTER_Y + (H - FOOTER_Y - creditH) / 2;
  const credit = await loadImg(MULESOO_CREDIT_SRC);
  if (credit) {
    ctx.drawImage(credit, cx, creditY, creditW, creditH);
  } else {
    ctx.fillStyle = MUTED;
    ctx.font = `600 9px ${font}`;
    tracked(ctx, "DESIGNED & BUILT BY", cx, FOOTER_Y + 44, 1.2);
    ctx.fillStyle = GOLD;
    ctx.font = `700 15px ${font}`;
    ctx.fillText("MULESOO DIGITAL SERVICES", cx, FOOTER_Y + 68);
    ctx.fillStyle = MUTED;
    ctx.font = `500 12px ${MONO}`;
    ctx.fillText("mulesoo.com  |  hello@mulesoo.com", cx, FOOTER_Y + 90);
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
