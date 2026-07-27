/**
 * A very small, dependency-free PDF writer — enough for a one-page receipt.
 *
 * Why hand-rolled: `jspdf` is in package.json but stays unimported because its
 * canvg → core-js chain does not bundle under Turbopack, and the existing
 * `lib/id-card/jpeg-pdf.ts` wraps a single JPEG, which cannot produce selectable
 * text. A financial receipt has to be real text — searchable, copyable, and
 * legible at any zoom — so this emits the handful of PDF objects that needs.
 *
 * Uses the PDF base-14 fonts (Helvetica), so nothing is embedded and the output
 * stays a few kilobytes. Coordinates are given from the TOP-left, which is how
 * the calling code thinks; the y axis is flipped when writing.
 */

const PAGE_W = 595.28; // A4 at 72dpi
const PAGE_H = 841.89;

type Font = "regular" | "bold" | "mono";
const FONT_RES: Record<Font, string> = {
  regular: "/F1",
  bold: "/F2",
  mono: "/F3",
};

/**
 * PDF strings are Latin-1. Anything outside it (Amharic, curly quotes, the ETB
 * birr sign) would otherwise emit mojibake, so transliterate what we can and
 * drop the rest rather than write bytes the reader will mangle.
 */
function pdfText(s: string): string {
  return String(s ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/•/g, "-")
    .replace(/ /g, " ")
    .replace(/[^\x20-\xFF]/g, "") // outside Latin-1: drop
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export class SimplePdf {
  private ops: string[] = [];

  /** Draw text. `y` is measured DOWN from the top of the page. */
  text(
    x: number,
    y: number,
    value: string,
    opts: { size?: number; font?: Font; color?: [number, number, number] } = {}
  ): this {
    const { size = 10, font = "regular", color = [0, 0, 0] } = opts;
    const [r, g, b] = color;
    this.ops.push(
      `BT ${r} ${g} ${b} rg ${FONT_RES[font]} ${size} Tf ` +
        `1 0 0 1 ${x.toFixed(2)} ${(PAGE_H - y).toFixed(2)} Tm ` +
        `(${pdfText(value)}) Tj ET`
    );
    return this;
  }

  /** Right-align text so money columns line up. */
  textRight(
    right: number,
    y: number,
    value: string,
    opts: { size?: number; font?: Font; color?: [number, number, number] } = {}
  ): this {
    const size = opts.size ?? 10;
    // Helvetica averages ~0.5em per char; the mono face is 0.6em. Good enough
    // for right-aligning short numeric strings without font metrics.
    const per = opts.font === "mono" ? 0.6 : 0.5;
    const width = pdfText(value).length * size * per;
    return this.text(right - width, y, value, opts);
  }

  line(x1: number, y1: number, x2: number, y2: number, gray = 0.8): this {
    this.ops.push(
      `${gray} G 0.7 w ${x1.toFixed(2)} ${(PAGE_H - y1).toFixed(2)} m ` +
        `${x2.toFixed(2)} ${(PAGE_H - y2).toFixed(2)} l S`
    );
    return this;
  }

  rect(
    x: number,
    y: number,
    w: number,
    h: number,
    color: [number, number, number] = [0.95, 0.95, 0.95]
  ): this {
    const [r, g, b] = color;
    this.ops.push(
      `${r} ${g} ${b} rg ${x.toFixed(2)} ${(PAGE_H - y - h).toFixed(2)} ` +
        `${w.toFixed(2)} ${h.toFixed(2)} re f`
    );
    return this;
  }

  /** Serialise to PDF bytes. */
  build(): Uint8Array {
    const content = this.ops.join("\n");
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> /Contents 4 0 R >>`,
      `<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
    ];

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(byteLength(pdf));
      pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });

    const xrefAt = byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) {
      pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
    }
    pdf +=
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
      `startxref\n${xrefAt}\n%%EOF\n`;

    // Latin-1: one byte per code unit, which is what the offsets above assume.
    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
    return bytes;
  }
}

/** Byte length under the Latin-1 encoding used by build(). */
function byteLength(s: string): number {
  return s.length;
}

export { pdfText as escapePdfText };
