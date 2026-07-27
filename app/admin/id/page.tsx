import { ShieldCheck, Fingerprint } from "lucide-react";
import { currentAdmin } from "@/lib/admin/permissions";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { FundraiserIdCard } from "@/components/owner/fundraiser-id-card";
import { StaffIdentityEditor } from "@/components/admin/staff-identity";
import { PageHeader, SectionCard, Chip } from "@/components/admin/ui";

export const metadata = { title: "Admin · My staff ID" };

export default async function AdminStaffIdPage() {
  const me = await currentAdmin();
  const user = await db.user.findUnique({
    where: { id: me.id },
    select: {
      name: true,
      adminCode: true,
      isSuperAdmin: true,
      idPhotoUrl: true,
      biometricEnrolledAt: true,
      createdAt: true,
    },
  });
  if (!user) return null;

  const roleLabel = user.isSuperAdmin ? "Super Administrator" : "Administrator";
  const code = user.adminCode ?? "STAFF";
  const enrolled = !!user.biometricEnrolledAt;

  return (
    <div>
      <PageHeader
        title="My staff ID"
        description="Your official Yewogen Derash staff credential. Download it as a high-resolution image or a print-ready PDF."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex justify-center">
          <FundraiserIdCard
            name={user.name}
            verificationCode={code}
            issued={formatDate(user.createdAt)}
            status="STAFF"
            subtitle="Official Staff ID"
            roleLabel={roleLabel}
            qrUrl={appUrl()}
            photoUrl={user.idPhotoUrl}
            approved
            showDownload
            fields={[
              { label: "Role", value: roleLabel },
              { label: "Staff ID", value: code },
              { label: "Platform", value: "Yewogen Derash" },
            ]}
          />
        </div>

        <div className="space-y-4">
          <SectionCard
            title="My ID photo & biometric"
            sub="Staff credentials stay under your control — update either at any time."
          >
            <div className="mb-4 flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-primary" aria-hidden />
              {enrolled ? (
                <Chip tone="success">
                  Biometric enrolled · {formatDate(user.biometricEnrolledAt!)}
                </Chip>
              ) : (
                <Chip tone="warning">Biometric not enrolled</Chip>
              )}
            </div>
            <StaffIdentityEditor
              personName={user.name}
              personCode={user.adminCode}
              photoUrl={user.idPhotoUrl}
              enrolledAt={
                user.biometricEnrolledAt ? formatDate(user.biometricEnrolledAt) : null
              }
            />
            <p className="mt-4 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              Once enrolled you can sign in at{" "}
              <span className="font-medium text-foreground">/admin-login</span> with
              your staff code{" "}
              <span className="font-mono font-medium text-foreground">{code}</span>{" "}
              and your face — no emailed code needed. Fundraiser photos and
              biometrics work differently: theirs are frozen at verification and
              can never be changed.
            </p>
          </SectionCard>

          <SectionCard title="About your staff ID">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                Every admin and sub-admin gets their own ID, keyed to their staff
                code ({code}).
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                Download it as a high-resolution PNG or a print-ready PDF from the
                card buttons.
              </li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
