/**
 * Donor privacy helpers.
 *
 * A fundraiser is entitled to a clear account of the money that reached their
 * campaign, but not to their donors' identities. Donors give on the basis that
 * the platform holds their details — several give anonymously and the rest gave
 * their name to Yewogen Derash, not to the fundraiser. So the fundraiser's
 * statement shows enough to recognise a gift they are expecting (a first name and
 * an initial, the date, the amount) and nothing that could be used to contact,
 * pressure, or identify a donor.
 *
 * Pure and dependency-free so it can be unit-tested; never relax these in a view
 * layer — mask at the point the row is built.
 */

/**
 * Show a donor as "Abebe K." — first name plus the initial of the next word.
 * Anonymous or missing names stay "Anonymous".
 */
export function maskDonorName(name: string | null | undefined): string {
  const raw = (name ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return "Anonymous";
  if (/^anonymous$/i.test(raw)) return "Anonymous";

  const parts = raw.split(" ");
  const first = parts[0];
  // A single-word name gives nothing away beyond itself; keep it as-is unless
  // it is long enough that trimming still leaves it recognisable.
  if (parts.length === 1) return first;
  const initial = parts[1]?.[0];
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

/**
 * Show only the tail of a payment reference — enough for a fundraiser to quote
 * it when querying a specific gift, not enough to reconstruct a donor's
 * transaction trail elsewhere.
 */
export function maskReference(ref: string | null | undefined, visible = 4): string {
  const raw = (ref ?? "").trim();
  if (!raw) return "—";
  if (raw.length <= visible) return `••••${raw}`;
  return `••••${raw.slice(-visible)}`;
}

/**
 * An email is never shown to a fundraiser. This exists so a view that
 * mistakenly reaches for one still cannot leak it, and so the intent is
 * greppable.
 */
export function maskDonorEmail(): string {
  return "hidden";
}
