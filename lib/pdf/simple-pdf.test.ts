import { describe, it, expect } from "vitest";
import { SimplePdf, escapePdfText } from "@/lib/pdf/simple-pdf";

const decode = (b: Uint8Array) => String.fromCharCode(...b);

describe("escapePdfText", () => {
  it("escapes the characters that would break a PDF string", () => {
    expect(escapePdfText("a(b)c")).toBe("a\\(b\\)c");
    expect(escapePdfText("back\\slash")).toBe("back\\\\slash");
  });

  it("transliterates typographic characters rather than mangling them", () => {
    expect(escapePdfText("don’t")).toBe("don't");
    expect(escapePdfText("a — b")).toBe("a - b");
    expect(escapePdfText("“quoted”")).toBe('"quoted"');
  });

  it("drops characters outside Latin-1 instead of emitting mojibake", () => {
    // Amharic has no place in a base-14 Latin font; better absent than garbled.
    expect(escapePdfText("ETB ሺህ 500")).toBe("ETB  500");
  });

  it("survives null and undefined", () => {
    expect(escapePdfText(undefined as unknown as string)).toBe("");
    expect(escapePdfText(null as unknown as string)).toBe("");
  });
});

describe("SimplePdf", () => {
  it("produces a well-formed single-page PDF", () => {
    const out = decode(new SimplePdf().text(50, 50, "Receipt").build());
    expect(out.startsWith("%PDF-1.4")).toBe(true);
    expect(out.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(out).toContain("/Type /Catalog");
    expect(out).toContain("/Type /Page ");
    expect(out).toContain("(Receipt) Tj");
  });

  it("declares an xref offset that actually points at the xref table", () => {
    const out = decode(new SimplePdf().text(10, 10, "x").build());
    const declared = Number(/startxref\n(\d+)/.exec(out)![1]);
    expect(out.slice(declared, declared + 4)).toBe("xref");
  });

  it("lists one xref entry per object plus the free head", () => {
    const out = decode(new SimplePdf().text(10, 10, "x").build());
    const size = Number(/\/Size (\d+)/.exec(out)![1]);
    const entries = out.match(/^\d{10} \d{5} [nf] $/gm)!;
    expect(entries.length).toBe(size);
  });

  it("offsets point at the start of each object", () => {
    const out = decode(new SimplePdf().text(10, 10, "x").build());
    const entries = out.match(/^(\d{10}) 00000 n $/gm)!;
    entries.forEach((e, i) => {
      const off = Number(e.slice(0, 10));
      expect(out.slice(off).startsWith(`${i + 1} 0 obj`)).toBe(true);
    });
  });

  it("flips y so callers can measure from the top", () => {
    // y=0 from the top must land at the page height in PDF space.
    const out = decode(new SimplePdf().text(0, 0, "top").build());
    expect(out).toContain("1 0 0 1 0.00 841.89 Tm");
  });

  it("keeps every byte inside Latin-1 so offsets stay valid", () => {
    const bytes = new SimplePdf().text(10, 10, "ETB 1,000 — paid").build();
    expect(bytes.every((b) => b <= 0xff)).toBe(true);
  });
});
