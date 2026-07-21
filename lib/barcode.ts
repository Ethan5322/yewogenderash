/**
 * Minimal, dependency-free Code128-B barcode → inline SVG.
 *
 * Used on the corporate Fundraiser ID card so the verification code is
 * machine-scannable (in addition to the QR). Code128-B covers the printable
 * ASCII set, which is all our author codes use (e.g. "YWD-A1B2C3").
 *
 * Renders as a self-contained SVG string (no external font/asset), so it works
 * inside the artifact CSP and on the server.
 */

// The 107 Code128 symbol patterns (index 0–106). Each is six module widths
// (bar,space,bar,space,bar,space); index 106 (stop) has the trailing bar.
const PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112",
];

const START_B = 104;
const STOP = 106;

/** Keep only printable ASCII (32–126); anything else becomes '?'. */
function sanitize(input: string): string {
  return Array.from(input)
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code <= 126 ? ch : "?";
    })
    .join("");
}

/**
 * Build a Code128-B barcode as an SVG string.
 * @param value    the data to encode (printable ASCII)
 * @param opts.moduleWidth  px width of one module (default 2)
 * @param opts.height       bar height in px (default 48)
 * @param opts.color        bar colour (default currentColor so it inherits theme)
 */
export function code128Svg(
  value: string,
  opts: { moduleWidth?: number; height?: number; color?: string } = {}
): string {
  const data = sanitize(value);
  const moduleWidth = opts.moduleWidth ?? 2;
  const height = opts.height ?? 48;
  const color = opts.color ?? "currentColor";

  const codes: number[] = [START_B];
  for (const ch of data) codes.push(ch.charCodeAt(0) - 32);

  // Weighted checksum (positions start at 1 for the first data symbol).
  let sum = START_B;
  data.split("").forEach((ch, i) => {
    sum += (ch.charCodeAt(0) - 32) * (i + 1);
  });
  codes.push(sum % 103);
  codes.push(STOP);

  // Concatenate module-width digits; the first module of every pattern is a bar.
  const widths = codes.map((c) => PATTERNS[c]).join("");

  let x = 0;
  let isBar = true;
  const rects: string[] = [];
  for (const digit of widths) {
    const w = Number(digit) * moduleWidth;
    if (isBar) {
      rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}" fill="${color}"/>`);
    }
    x += w;
    isBar = !isBar;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${height}" viewBox="0 0 ${x} ${height}" preserveAspectRatio="none" role="img" aria-label="Barcode ${data}">${rects.join("")}</svg>`;
}
