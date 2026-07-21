// Build a one-page PDF that embeds a single JPEG at an exact physical size.
//
// jsPDF would do this too, but it statically pulls in canvg + core-js (only
// needed for its SVG path), which fails to bundle. We only ever wrap one JPEG,
// so we emit the minimal PDF structure ourselves — no dependency, no bundler
// headaches, and it works in production builds.

function strBytes(s: string): Uint8Array {
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 0xff;
  return a;
}

/**
 * @param jpeg  raw baseline-JPEG bytes (e.g. from canvas.toBlob('image/jpeg'))
 * @param pxW/pxH  the JPEG's pixel dimensions
 * @param mmW/mmH  the physical page size in millimetres (CR80 = 85.6 × 54)
 */
export function jpegToPdfBlob(
  jpeg: Uint8Array,
  pxW: number,
  pxH: number,
  mmW: number,
  mmH: number
): Blob {
  const ptW = (mmW * 72) / 25.4;
  const ptH = (mmH * 72) / 25.4;

  const chunks: Uint8Array[] = [];
  let pos = 0;
  const offsets: number[] = [];
  const push = (b: Uint8Array) => {
    chunks.push(b);
    pos += b.length;
  };
  const pushStr = (s: string) => push(strBytes(s));

  pushStr("%PDF-1.3\n");

  offsets[1] = pos;
  pushStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  offsets[2] = pos;
  pushStr("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  offsets[3] = pos;
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW.toFixed(2)} ${ptH.toFixed(
      2
    )}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  offsets[4] = pos;
  pushStr(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
  );
  push(jpeg);
  pushStr("\nendstream\nendobj\n");

  const content = `q ${ptW.toFixed(2)} 0 0 ${ptH.toFixed(2)} 0 0 cm /Im0 Do Q\n`;
  offsets[5] = pos;
  pushStr(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

  const xrefPos = pos;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pushStr(xref);
  pushStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);

  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}
