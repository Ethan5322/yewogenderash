import { verifyCaptureToken } from "@/lib/capture-token";
import { db } from "@/lib/db";
import { MobileCapture } from "@/components/capture/mobile-capture";

export const metadata = {
  title: "Face capture",
  robots: { index: false, follow: false },
};

export default async function CapturePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ownerId = verifyCaptureToken(token);
  const owner = ownerId
    ? await db.campaignOwner.findUnique({
        where: { id: ownerId },
        select: { user: { select: { name: true } } },
      })
    : null;

  if (!ownerId || !owner) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center p-8 text-center">
        <h1 className="text-lg font-semibold">Link expired</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This capture link is invalid or has expired. Please generate a new QR
          code on your computer and scan it again.
        </p>
      </div>
    );
  }

  return <MobileCapture token={token} name={owner.user.name} />;
}
