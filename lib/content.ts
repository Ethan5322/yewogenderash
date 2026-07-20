import "server-only";
import { cache } from "react";
import { z } from "zod";
import { db } from "@/lib/db";

/**
 * Admin-managed site content ("CMS-lite"). Every editable block is registered
 * here with a Zod schema and a hard-coded default. The default is the source of
 * truth when no DB row exists (or the row fails validation, or the DB is
 * unreachable at build time) — so pages always render, live DB or not.
 *
 * Content is stored one row per key in `SiteContent` (`yd_site_content`), value
 * as JSON. Admins edit it at /admin/content.
 */

// ── Schemas ──────────────────────────────────────────────────────

export const faqSchema = z.object({
  items: z
    .array(z.object({ q: z.string().min(1), a: z.string().min(1) }))
    .min(1),
});
export type FaqContent = z.infer<typeof faqSchema>;

export const announcementSchema = z.object({
  /** When false the banner does not render at all. */
  enabled: z.boolean(),
  message: z.string().trim().max(300),
  /** Optional link target for the whole banner (internal path or URL). */
  href: z.string().trim().max(300).optional().or(z.literal("")),
});
export type AnnouncementContent = z.infer<typeof announcementSchema>;

// ── Registry ─────────────────────────────────────────────────────

type ContentEntry<S extends z.ZodTypeAny> = {
  label: string;
  description: string;
  schema: S;
  default: z.infer<S>;
};

const FAQ_DEFAULT: FaqContent = {
  items: [
    {
      q: "How do I know a campaign is genuine?",
      a: "Every campaign owner completes identity verification — ID document upload and a live face capture — and passes manual administrator review before their campaign goes live. Verified campaigns show a Mulesoo trust seal and the owner's verification code.",
    },
    {
      q: "Where does my donation go?",
      a: "Each campaign has its own separated ledger. Your donation is tied to exactly one campaign and is never pooled with others. A campaign's querycode and QR always point to that single campaign.",
    },
    {
      q: "What is a querycode?",
      a: "A querycode is a unique short code assigned to each campaign. Scanning its QR code or entering the code takes you straight to that campaign's donation page — it can never point to more than one campaign.",
    },
    {
      q: "How are payouts handled?",
      a: "Campaign owners request payouts, and every payout is reviewed and approved by an administrator before funds are released. Owners cannot self-release funds. Every payout is recorded and audited.",
    },
    {
      q: "How do I start a campaign?",
      a: "Create an account, verify your email and phone, accept the terms and fee policy, upload your identity and supporting documents, and complete face verification. Once an administrator approves you, you can create campaigns.",
    },
    {
      q: "Can I donate anonymously?",
      a: "Yes. When donating you can choose to hide your name from the public supporters list. Your payment is still processed securely.",
    },
  ],
};

/**
 * The single source of registered content. Add a key here to make a new block
 * admin-editable; the editor at /admin/content picks it up automatically.
 */
export const CONTENT_REGISTRY = {
  "support.faq": {
    label: "FAQ",
    description:
      "Questions and answers shown on the public /support/faq page.",
    schema: faqSchema,
    default: FAQ_DEFAULT,
  } satisfies ContentEntry<typeof faqSchema>,
  "site.announcement": {
    label: "Announcement banner",
    description:
      "A site-wide banner shown above the header on every public page. Disable it to hide.",
    schema: announcementSchema,
    default: { enabled: false, message: "", href: "" },
  } satisfies ContentEntry<typeof announcementSchema>,
} as const;

export type ContentKey = keyof typeof CONTENT_REGISTRY;

export function isContentKey(key: string): key is ContentKey {
  return Object.prototype.hasOwnProperty.call(CONTENT_REGISTRY, key);
}

export function contentMeta(): Array<{
  key: ContentKey;
  label: string;
  description: string;
}> {
  return (Object.keys(CONTENT_REGISTRY) as ContentKey[]).map((key) => ({
    key,
    label: CONTENT_REGISTRY[key].label,
    description: CONTENT_REGISTRY[key].description,
  }));
}

// ── Loaders ──────────────────────────────────────────────────────

/**
 * Validated content for a key. Returns the registered default if the row is
 * missing, invalid, or the DB is unreachable. Request-cached so multiple reads
 * of the same key in one render hit the DB once.
 */
export const getContent = cache(
  async <K extends ContentKey>(
    key: K
  ): Promise<z.infer<(typeof CONTENT_REGISTRY)[K]["schema"]>> => {
    const entry = CONTENT_REGISTRY[key];
    try {
      const row = await db.siteContent.findUnique({ where: { key } });
      if (row) {
        const parsed = entry.schema.safeParse(row.value);
        if (parsed.success) {
          return parsed.data as z.infer<(typeof CONTENT_REGISTRY)[K]["schema"]>;
        }
        console.error(`[content] stored value for "${key}" failed validation`);
      }
    } catch (err) {
      console.error(`[content] failed to load "${key}":`, err);
    }
    return entry.default as z.infer<(typeof CONTENT_REGISTRY)[K]["schema"]>;
  }
);

/**
 * The raw stored value (or default) for admin editing — unparsed so the editor
 * can show and repair even a value that no longer matches the schema.
 */
export async function getRawContent(key: ContentKey): Promise<unknown> {
  try {
    const row = await db.siteContent.findUnique({ where: { key } });
    if (row) return row.value;
  } catch (err) {
    console.error(`[content] failed to load raw "${key}":`, err);
  }
  return CONTENT_REGISTRY[key].default;
}
