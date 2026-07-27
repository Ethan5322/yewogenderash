import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SimplePdf } from "@/lib/pdf/simple-pdf";
import { formatETB, formatDateTime, toNumber } from "@/lib/format";
import { WITHHOLDING_FEE_RATE } from "@/lib/fees";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

/**
 * Downloadable PDF receipt for one withdrawal.
 *
 * A fundraiser moving money out needs a document they can file, send to a bank,
 * or show whoever funds them — a row on a web page is not that. This states what
 * was requested, the safety & guarantee withholding taken from it, what was
 * actually transferred, and where it went.
 *
 * Ownership-scoped: the payout must belong to the signed-in user's owner
 * profile. A payout belonging to anyone else is a 404 rather than a 403, so this
 * never confirms that someone else's payout id exists.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Sign in to download this receipt.", { status: 401 });
  }
  const { id } = await params;

  const payout = await db.payout.findFirst({
    where: { id, owner: { userId: session.user.id } },
    select: {
      id: true,
      amount: true,
      withholdingFee: true,
      netPaidAmount: true,
      currency: true,
      status: true,
      payoutReference: true,
      note: true,
      createdAt: true,
      approvedAt: true,
      paidAt: true,
      campaign: { select: { title: true, queryCode: true } },
      owner: {
        select: {
          authorCode: true,
          user: { select: { name: true, email: true } },
        },
      },
      payoutAccountRef: {
        select: { accountName: true, bankName: true, accountNumber: true },
      },
    },
  });
  if (!payout) return new Response("Not found", { status: 404 });

  const cur = payout.currency;
  const requested = toNumber(payout.amount);
  const withheld = toNumber(payout.withholdingFee);
  const net = payout.netPaidAmount === null ? requested : toNumber(payout.netPaidAmount);
  const acct = payout.payoutAccountRef;

  // Account numbers are masked even on the owner's own receipt: these get
  // emailed and forwarded, and the last four are enough to identify the account.
  const maskedAccount = acct?.accountNumber
    ? `••••${acct.accountNumber.slice(-4)}`
    : "—";

  const pdf = new SimplePdf();
  const L = 56; // left margin
  const R = 539; // right margin
  let y = 70;

  // ── Masthead ──
  pdf.rect(0, 0, 595.28, 8, [0.06, 0.48, 0.3]);
  pdf.text(L, y, SITE_NAME, { size: 18, font: "bold", color: [0.06, 0.48, 0.3] });
  pdf.text(L, y + 16, "Withdrawal receipt", { size: 11, color: [0.35, 0.35, 0.35] });
  pdf.textRight(R, y, payout.status, { size: 11, font: "bold" });
  pdf.textRight(R, y + 16, `Receipt ${payout.id.slice(-10).toUpperCase()}`, {
    size: 9,
    font: "mono",
    color: [0.4, 0.4, 0.4],
  });

  y += 40;
  pdf.line(L, y, R, y);
  y += 26;

  // ── Who and what ──
  const rows: [string, string][] = [
    ["Fundraiser", payout.owner.user.name],
    ["Fundraiser code", payout.owner.authorCode ?? "—"],
    ["Campaign", payout.campaign.title],
    ["Querycode", payout.campaign.queryCode],
    ["Requested", formatDateTime(payout.createdAt)],
    ["Approved", payout.approvedAt ? formatDateTime(payout.approvedAt) : "—"],
    ["Paid", payout.paidAt ? formatDateTime(payout.paidAt) : "—"],
    ["Transfer reference", payout.payoutReference ?? "—"],
  ];
  for (const [label, value] of rows) {
    pdf.text(L, y, label, { size: 9, color: [0.42, 0.42, 0.42] });
    pdf.text(L + 150, y, value, { size: 10 });
    y += 19;
  }

  y += 10;
  pdf.line(L, y, R, y);
  y += 26;

  // ── The money ──
  pdf.text(L, y, "Amount", { size: 12, font: "bold" });
  y += 24;

  const money: [string, string, boolean][] = [
    ["Amount requested", formatETB(requested, cur), false],
    [
      `Safety & guarantee withholding (${Math.round(WITHHOLDING_FEE_RATE * 100)}% of funds raised, charged once)`,
      `- ${formatETB(withheld, cur)}`,
      false,
    ],
    ["Amount transferred", formatETB(net, cur), true],
  ];
  for (const [label, value, strong] of money) {
    pdf.text(L, y, label, { size: strong ? 11 : 10, font: strong ? "bold" : "regular" });
    pdf.textRight(R, y, value, {
      size: strong ? 12 : 10,
      font: strong ? "bold" : "mono",
      color: strong ? [0.06, 0.48, 0.3] : [0.1, 0.1, 0.1],
    });
    if (strong) {
      pdf.line(L, y - 14, R, y - 14, 0.6);
    }
    y += 22;
  }

  y += 14;
  pdf.line(L, y, R, y);
  y += 26;

  // ── Destination ──
  pdf.text(L, y, "Paid to", { size: 12, font: "bold" });
  y += 22;
  pdf.text(L, y, "Account name", { size: 9, color: [0.42, 0.42, 0.42] });
  pdf.text(L + 150, y, acct?.accountName ?? "—", { size: 10 });
  y += 19;
  pdf.text(L, y, "Bank", { size: 9, color: [0.42, 0.42, 0.42] });
  pdf.text(L + 150, y, acct?.bankName ?? "—", { size: 10 });
  y += 19;
  pdf.text(L, y, "Account number", { size: 9, color: [0.42, 0.42, 0.42] });
  pdf.text(L + 150, y, maskedAccount, { size: 10, font: "mono" });

  // ── Footer ──
  pdf.line(L, 742, R, 742);
  pdf.text(L, 760, "This receipt was generated by " + SITE_NAME + ".", {
    size: 8,
    color: [0.45, 0.45, 0.45],
  });
  pdf.text(
    L,
    772,
    "Funds are held per campaign and released only after administrator approval. " +
      "Every payout is audited.",
    { size: 8, color: [0.45, 0.45, 0.45] }
  );
  pdf.text(L, 784, SITE_URL.replace(/^https?:\/\//, ""), {
    size: 8,
    color: [0.06, 0.48, 0.3],
  });
  pdf.textRight(R, 784, `Issued ${formatDateTime(new Date())}`, {
    size: 8,
    color: [0.45, 0.45, 0.45],
  });

  const bytes = pdf.build();
  const filename = `yewogen-derash-withdrawal-${payout.id.slice(-8)}.pdf`;

  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
    },
  });
}
