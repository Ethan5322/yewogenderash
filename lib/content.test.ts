import { describe, it, expect } from "vitest";
import {
  faqSchema,
  announcementSchema,
  CONTENT_REGISTRY,
  isContentKey,
} from "@/lib/content";

describe("faqSchema", () => {
  it("accepts a well-formed FAQ list", () => {
    const r = faqSchema.safeParse({ items: [{ q: "Q?", a: "A." }] });
    expect(r.success).toBe(true);
  });
  it("rejects an empty item list", () => {
    expect(faqSchema.safeParse({ items: [] }).success).toBe(false);
  });
  it("rejects an entry missing its answer", () => {
    expect(faqSchema.safeParse({ items: [{ q: "Q?" }] }).success).toBe(false);
  });
});

describe("announcementSchema", () => {
  it("accepts an enabled banner with a message", () => {
    const r = announcementSchema.safeParse({
      enabled: true,
      message: "We are live",
      href: "/campaigns",
    });
    expect(r.success).toBe(true);
  });
  it("allows an empty href", () => {
    expect(
      announcementSchema.safeParse({ enabled: false, message: "", href: "" })
        .success
    ).toBe(true);
  });
  it("rejects a non-boolean enabled flag", () => {
    expect(
      announcementSchema.safeParse({ enabled: "yes", message: "x" }).success
    ).toBe(false);
  });
});

describe("registry defaults are self-consistent", () => {
  it("every registered default validates against its own schema", () => {
    for (const key of Object.keys(CONTENT_REGISTRY) as Array<
      keyof typeof CONTENT_REGISTRY
    >) {
      const entry = CONTENT_REGISTRY[key];
      expect(entry.schema.safeParse(entry.default).success).toBe(true);
    }
  });
  it("isContentKey guards unknown keys", () => {
    expect(isContentKey("support.faq")).toBe(true);
    expect(isContentKey("nope")).toBe(false);
  });
});
