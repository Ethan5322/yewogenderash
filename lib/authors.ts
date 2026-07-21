import "server-only";
import { db } from "@/lib/db";
import { PUBLIC_STATUSES } from "@/lib/campaigns";

/**
 * Public author profile by verification code (brief §7.2). Includes the owner's
 * public campaigns. The SELFIE document path is returned too but is only ever
 * resolved to a (signed, private) URL for admins — never exposed publicly.
 */
export async function getAuthorProfile(authorCode: string) {
  return db.campaignOwner.findUnique({
    where: { authorCode },
    select: {
      id: true,
      authorCode: true,
      mulesooVerified: true,
      verifiedAt: true,
      biometricStatus: true,
      createdAt: true,
      user: { select: { name: true, verificationStatus: true } },
      campaigns: {
        where: { status: { in: PUBLIC_STATUSES } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          category: true,
          currentAmount: true,
          targetAmount: true,
          currency: true,
          queryCode: true,
        },
      },
      documents: {
        where: { documentType: "SELFIE" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { fileUrl: true, status: true, createdAt: true },
      },
    },
  });
}
