import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/seo";
import { BRAND_HAND_PATHS, BRAND_HEART_PATH } from "@/lib/brand";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Yewogen Derash — Verified Crowdfunding, Worldwide";

/** Branded default social-share image (Open Graph / Twitter). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f7a4d 0%, #0a5a39 60%, #0b1620 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
          padding: 80,
        }}
      >
        <svg width="150" height="150" viewBox="0 0 24 24">
          <path d={BRAND_HEART_PATH} fill="#e8b04b" />
          {BRAND_HAND_PATHS.map((d) => (
            <path key={d} d={d} fill="#ffffff" />
          ))}
        </svg>
        <div style={{ fontSize: 76, fontWeight: 800, marginTop: 28, letterSpacing: -1 }}>
          {SITE_NAME}
        </div>
        <div style={{ fontSize: 36, marginTop: 10, opacity: 0.92 }}>
          Verified Crowdfunding, Worldwide
        </div>
        <div style={{ fontSize: 24, marginTop: 36, opacity: 0.8, textAlign: "center", maxWidth: 900 }}>
          Identity-verified owners · one campaign, one querycode · audited payouts
        </div>
      </div>
    ),
    size
  );
}
