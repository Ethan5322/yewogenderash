/**
 * Seed: one admin user + demo owner/campaigns for local development.
 * Run: npx prisma db seed
 *
 * The admin password comes from SEED_ADMIN_PASSWORD (falls back to a dev-only
 * default). Change it immediately in any real environment.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

// Prisma 7 requires a driver adapter. Seed over the DIRECT (session) connection
// to avoid pooled prepared-statement quirks.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DIRECT_URL/DATABASE_URL missing — run with --env-file=.env");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@yewogenderash.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe-Dev-Only-1!";

  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: { isSuperAdmin: true },
    create: {
      name: "Platform Admin",
      email: adminEmail,
      emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "ADMIN",
      verificationStatus: "VERIFIED",
      isSuperAdmin: true,
    },
  });
  console.log(`Admin ready: ${admin.email}`);

  // Dev-only demo data (skipped in production)
  if (process.env.NODE_ENV === "production") return;

  const ownerUser = await db.user.upsert({
    where: { email: "owner@demo.local" },
    update: {},
    create: {
      name: "Abebe Kebede",
      email: "owner@demo.local",
      emailVerifiedAt: new Date(),
      phone: "+251900000001",
      phoneVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash("Demo-Owner-1!", 12),
      role: "OWNER",
      verificationStatus: "VERIFIED",
      ownerProfile: {
        create: {
          biometricStatus: "VERIFIED",
          authorCode: "YWD-DEMO01",
          mulesooVerified: true,
          verifiedAt: new Date(),
          termsAcceptedAt: new Date(),
          feesAcceptedAt: new Date(),
          biometricConsentAt: new Date(),
        },
      },
    },
    include: { ownerProfile: true },
  });

  const owner =
    ownerUser.ownerProfile ??
    (await db.campaignOwner.findUniqueOrThrow({ where: { userId: ownerUser.id } }));

  const demoCampaigns = [
    {
      title: "Heart Surgery for Selam",
      slug: "heart-surgery-for-selam",
      description:
        "Help 8-year-old Selam get the corrective heart surgery she urgently needs at the Cardiac Centre in Addis Ababa.",
      story:
        "Selam was diagnosed with a congenital heart defect at age 3. Her family has raised half of the surgery cost; this campaign covers the remainder, verified against the hospital's treatment estimate.",
      category: "MEDICAL" as const,
      targetAmount: 450000,
      queryCode: "SELAM01",
      status: "ACTIVE" as const,
      location: "Addis Ababa",
      isFeatured: true,
    },
    {
      title: "School Library for Bahir Dar Primary",
      slug: "school-library-bahir-dar",
      description:
        "Build and stock a library serving 600 students at a public primary school in Bahir Dar.",
      story:
        "The school has no library. This campaign funds shelving, 2,000 books in Amharic and English, and reading furniture — verified with the school administration's letter.",
      category: "EDUCATION" as const,
      targetAmount: 250000,
      queryCode: "LIBRARY1",
      status: "ACTIVE" as const,
      location: "Bahir Dar",
      isFeatured: true,
    },
    {
      title: "Clean Water Well for Soddo Village",
      slug: "clean-water-well-soddo",
      description:
        "Drill a borehole well giving 1,200 villagers access to safe drinking water.",
      category: "COMMUNITY" as const,
      targetAmount: 600000,
      queryCode: "WATER001",
      status: "PENDING_REVIEW" as const,
      location: "Soddo, SNNPR",
      isFeatured: false,
    },
  ];

  for (const c of demoCampaigns) {
    await db.campaign.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, ownerId: owner.id },
    });
  }
  console.log(`Seeded ${demoCampaigns.length} demo campaigns.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
