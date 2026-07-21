import { ShieldCheck } from "lucide-react";
import { code128Svg } from "@/lib/barcode";
import { formatDate } from "@/lib/format";

/**
 * Corporate Fundraiser ID — rendered at true ATM/CR80 proportions (1.586:1).
 *
 * Front of the card carries: portrait, full name, unique verification code,
 * issue date, the Mulesoo trust seal, a scannable QR (opens the public
 * verification profile /a/<code>, where admins additionally see the biometric
 * capture), and a Code128 barcode of the verification code. Pure server
 * component — no client JS needed to display it.
 */
export function FundraiserIdCard({
  name,
  authorCode,
  verifiedAt,
  photoUrl,
  mulesooVerified,
  qrSrc,
}: {
  name: string;
  authorCode: string;
  verifiedAt: Date | null;
  photoUrl: string | null;
  mulesooVerified: boolean;
  qrSrc?: string;
}) {
  const qr = qrSrc ?? `/a/${authorCode}/qr`;
  const barcode = code128Svg(authorCode, { moduleWidth: 2, height: 44, color: "#0f172a" });
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="w-full max-w-[420px]" style={{ containerType: "inline-size" }}>
      <div className="relative aspect-[1.586/1] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0b2545] via-[#13315c] to-[#0b2545] text-white shadow-xl">
        {/* Guilloché-style security sheen */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 15%, #ffffff 0, transparent 45%), radial-gradient(circle at 85% 90%, #ffffff 0, transparent 40%)",
          }}
          aria-hidden
        />

        <div className="relative flex h-full flex-col p-[5%]">
          {/* Header band */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[2.6cqw] font-bold uppercase leading-none tracking-[0.2em] text-amber-300">
                Yewogen Derash
              </p>
              <p className="mt-[0.4cqw] text-[2.2cqw] font-medium uppercase tracking-[0.18em] text-white/70">
                Verified Fundraiser ID
              </p>
            </div>
            {mulesooVerified ? (
              <span className="inline-flex items-center gap-[0.6cqw] rounded-full bg-amber-300/15 px-[2cqw] py-[0.8cqw] text-[2cqw] font-semibold text-amber-200 ring-1 ring-amber-300/40">
                <ShieldCheck className="h-[2.6cqw] w-[2.6cqw]" aria-hidden />
                MULESOO
              </span>
            ) : null}
          </div>

          {/* Body: portrait + details + QR */}
          <div className="mt-[3%] flex flex-1 items-stretch gap-[3.5%]">
            {/* Portrait */}
            <div className="flex aspect-[3/4] h-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10 ring-1 ring-white/20">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- public portrait URL
                <img src={photoUrl} alt={`${name}`} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[6cqw] font-bold text-white/80">{initials}</span>
              )}
            </div>

            {/* Details */}
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <p className="text-[1.9cqw] uppercase tracking-[0.15em] text-white/50">
                Full name
              </p>
              <p className="truncate text-[3.6cqw] font-bold leading-tight">{name}</p>

              <p className="mt-[2.5cqw] text-[1.9cqw] uppercase tracking-[0.15em] text-white/50">
                Verification code
              </p>
              <p className="font-mono text-[3cqw] font-semibold tracking-wider text-amber-200">
                {authorCode}
              </p>

              <p className="mt-[2.5cqw] text-[1.9cqw] uppercase tracking-[0.15em] text-white/50">
                Issued
              </p>
              <p className="text-[2.4cqw] font-medium">
                {verifiedAt ? formatDate(verifiedAt) : "—"}
              </p>
            </div>

            {/* QR */}
            <div className="flex shrink-0 items-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- dynamic PNG route */}
              <img
                src={qr}
                alt={`Verification QR for ${authorCode}`}
                className="aspect-square h-[46%] rounded-md bg-white p-[0.6cqw]"
                style={{ width: "auto" }}
              />
            </div>
          </div>

          {/* Barcode strip */}
          <div className="mt-[2.5%] rounded-md bg-white px-[2cqw] py-[1cqw]">
            <div
              className="h-[7cqw] w-full [&>svg]:h-full [&>svg]:w-full"
              // eslint-disable-next-line react/no-danger -- self-generated, sanitized SVG
              dangerouslySetInnerHTML={{ __html: barcode }}
            />
            <p className="mt-[0.4cqw] text-center font-mono text-[1.8cqw] tracking-[0.3em] text-slate-800">
              {authorCode}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
