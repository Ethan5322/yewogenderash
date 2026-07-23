/**
 * Regenerates the two entry QR codes (public site + admin panel).
 *
 * The codes encode whatever NEXT_PUBLIC_APP_URL points at, so they must be
 * regenerated whenever that changes — which on a laptop is every time the
 * Wi-Fi hands out a new LAN IP. After deploying, set NEXT_PUBLIC_APP_URL to
 * the real domain and run this once more; the codes then work anywhere.
 *
 *   node scripts/make-qr.mjs                  -> writes to ./Yewogen Derash QR Codes
 *   node scripts/make-qr.mjs "<extra dir>"    -> also writes a copy there
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function appUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const env = readFileSync(join(ROOT, ".env"), "utf8");
  const m = env.match(/^\s*NEXT_PUBLIC_APP_URL\s*=\s*(.+)\s*$/m);
  if (!m) throw new Error("NEXT_PUBLIC_APP_URL not found in .env");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const base = appUrl().replace(/\/+$/, "");
const targets = [
  { file: "public-site-qr.png", url: `${base}/`, label: "Public site" },
  { file: "admin-panel-qr.png", url: `${base}/admin-login`, label: "Admin panel" },
];

// High error correction + a wide quiet zone: these get printed and photographed
// off screens, where a tight margin is the usual reason a scan fails.
const OPTS = {
  errorCorrectionLevel: "H",
  margin: 4,
  width: 1024,
  color: { dark: "#0f7a4d", light: "#ffffff" },
};

const outDirs = [join(ROOT, "Yewogen Derash QR Codes"), ...process.argv.slice(2)];

for (const dir of outDirs) {
  mkdirSync(dir, { recursive: true });
  for (const t of targets) {
    await QRCode.toFile(join(dir, t.file), t.url, OPTS);
    console.log(`  ${t.label.padEnd(12)} -> ${t.url}`);
  }
  writeFileSync(
    join(dir, "README.txt"),
    [
      "Yewogen Derash — entry QR codes",
      "=".repeat(40),
      "",
      `Generated: ${new Date().toISOString()}`,
      `Base URL:  ${base}`,
      "",
      `public-site-qr.png  ->  ${targets[0].url}`,
      `admin-panel-qr.png  ->  ${targets[1].url}`,
      "",
      base.includes("://localhost") || /:\/\/\d+\.\d+\.\d+\.\d+/.test(base)
        ? [
            "!! THESE ARE LOCAL-NETWORK CODES — they are not public links.",
            "",
            "For a phone to scan them successfully, ALL of the following must hold:",
            "  1. The dev server is running:  npx next dev -H 0.0.0.0 -p 3000",
            "  2. The phone is on the SAME Wi-Fi as this laptop.",
            "  3. Windows Firewall allows inbound TCP port 3000 (private network).",
            "  4. The laptop still has this exact IP. Wi-Fi reassigns it often —",
            "     when it changes, update NEXT_PUBLIC_APP_URL in .env and run:",
            "         node scripts/make-qr.mjs",
            "",
            "Once the site is deployed, set NEXT_PUBLIC_APP_URL to the real domain",
            "and regenerate — the codes will then work on any device, anywhere.",
          ].join("\n")
        : "These codes point at the live domain and work on any device.",
      "",
    ].join("\n"),
    "utf8"
  );
  console.log(`Wrote ${dir}`);
}
