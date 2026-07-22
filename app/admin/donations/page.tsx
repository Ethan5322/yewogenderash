import Link from "next/link";
import { Search } from "lucide-react";
import type { DonationStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { DonationActions } from "@/components/admin/donation-actions";
import { formatETB, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Admin · Donations" };

const FILTERS: { value: DonationStatus | "ALL"; label: string }[] = [
  { value: "SUCCESS", label: "Successful" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "DISPUTED", label: "Disputed" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "ALL", label: "All" },
];
const VALID = new Set(FILTERS.map((f) => f.value));

const STATUS_STYLE: Record<string, string> = {
  SUCCESS: "text-success",
  REFUNDED: "text-warning",
  DISPUTED: "text-destructive",
  PENDING: "text-muted-foreground",
  FAILED: "text-muted-foreground",
  CANCELLED: "text-muted-foreground",
};

export default async function AdminDonationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("payouts");
  const sp = await searchParams;
  const raw = typeof sp.status === "string" ? sp.status : "SUCCESS";
  const status = (VALID.has(raw as DonationStatus | "ALL") ? raw : "SUCCESS") as DonationStatus | "ALL";
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 60);

  const where: Prisma.DonationWhereInput = {
    ...(status === "ALL" ? {} : { status }),
    ...(q
      ? {
          OR: [
            { donorName: { contains: q, mode: "insensitive" } },
            { txRef: { contains: q, mode: "insensitive" } },
            { campaign: { title: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [donations, totals] = await Promise.all([
    db.donation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, amount: true, platformFee: true, netAmount: true, currency: true,
        status: true, donorName: true, txRef: true, paidAt: true, createdAt: true,
        campaign: { select: { id: true, title: true } },
      },
    }),
    db.donation.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true, platformFee: true, netAmount: true }, _count: true }),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Donations</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every transaction across all campaigns. Refunds and disputes are recorded
        here and reverse the campaign balance.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Tile label="Successful donations" value={String(totals._count)} />
        <Tile label="Gross received" value={formatETB(Number(totals._sum.amount ?? 0))} />
        <Tile label="Net to campaigns" value={formatETB(Number(totals._sum.netAmount ?? 0))} />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={`/admin/donations?status=${f.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                status === f.value ? "border-transparent bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-accent"
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <form action="/admin/donations" className="relative">
          <input type="hidden" name="status" value={status} />
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Donor, reference, campaign…" className="h-9 w-60 rounded-md border border-input bg-background pl-8 pr-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </form>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Donor</th>
              <th className="px-4 py-3 font-medium">Campaign</th>
              <th className="px-4 py-3 font-medium">Gross / fee / net</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {donations.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No donations match.</td></tr>
            ) : (
              donations.map((d) => (
                <tr key={d.id} className="border-b align-top last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(d.paidAt ?? d.createdAt)}</td>
                  <td className="px-4 py-3">{d.donorName ?? "Anonymous"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/campaigns/${d.campaign.id}`} className="font-medium hover:text-primary hover:underline">{d.campaign.title}</Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-semibold">{formatETB(Number(d.amount), d.currency)}</span>
                    <span className="text-xs text-muted-foreground"> · {formatETB(Number(d.platformFee), d.currency)} · {formatETB(Number(d.netAmount), d.currency)}</span>
                  </td>
                  <td className={cn("px-4 py-3 text-xs font-semibold", STATUS_STYLE[d.status])}>{d.status}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.txRef}</td>
                  <td className="px-4 py-3"><DonationActions id={d.id} status={d.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  );
}
