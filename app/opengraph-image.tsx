import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/seo";

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
          <path
            d="M12 2.4 19.6 5.2 V11 C19.6 15.9 16.3 19.6 12 21.7 C7.7 19.6 4.4 15.9 4.4 11 V5.2 Z"
            fill="#ffffff"
          />
          <path
            d="M12 16.5 C11.85 16.5 6.9 13.35 6.9 9.75 C6.9 8.12 8.12 6.9 9.6 6.9 C10.68 6.9 11.62 7.56 12 8.46 C12.38 7.56 13.32 6.9 14.4 6.9 C15.88 6.9 17.1 8.12 17.1 9.75 C17.1 13.35 12.15 16.5 12 16.5 Z"
            fill="#12a05f"
          />
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
