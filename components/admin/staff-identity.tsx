"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Fingerprint, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FaceScan } from "@/components/auth/face-scan";
import { IdPhotoPicker } from "@/components/admin/id-photo-picker";
import {
  uploadStaffPhotoAction,
  enrolStaffFaceAction,
  clearStaffFaceAction,
} from "@/app/admin/id/actions";

/**
 * Staff ID photo + face-biometric editor. An admin uses it on their own record
 * at any time; the main admin uses it (with `targetId`) on a sub-admin.
 *
 * The photo comes from the device gallery and is cropped to the ID card's 3:4
 * portrait in the browser. The face template is captured live with a liveness
 * challenge and becomes the biometric factor for staff sign-in.
 */
export function StaffIdentityEditor({
  targetId,
  photoUrl,
  enrolledAt,
  compact = false,
}: {
  targetId?: string;
  photoUrl: string | null;
  enrolledAt: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [photoMsg, setPhotoMsg] = React.useState<string | null>(null);
  const [photoErr, setPhotoErr] = React.useState<string | null>(null);
  const [faceMsg, setFaceMsg] = React.useState<string | null>(null);
  const [faceErr, setFaceErr] = React.useState<string | null>(null);

  /** The picker hands over an already-cropped portrait — just store it. */
  async function onPhoto(file: File) {
    setPhotoErr(null);
    setPhotoMsg(null);
    const fd = new FormData();
    if (targetId) fd.set("targetId", targetId);
    fd.set("photo", file);
    const res = await uploadStaffPhotoAction(null, fd);
    if (res.ok) {
      setPhotoMsg("ID photo updated.");
      router.refresh();
    } else {
      setPhotoErr(res.error);
    }
  }

  function onFace(descriptor: number[] | null) {
    if (!descriptor) return;
    setFaceErr(null);
    setFaceMsg(null);
    const fd = new FormData();
    if (targetId) fd.set("targetId", targetId);
    fd.set("descriptor", JSON.stringify(descriptor));
    fd.set("liveness", "passed");
    startTransition(async () => {
      const res = await enrolStaffFaceAction(null, fd);
      if (res.ok) {
        setFaceMsg("Face biometric enrolled — it can now be used to sign in.");
        router.refresh();
      } else {
        setFaceErr(res.error);
      }
    });
  }

  function clearFace() {
    setFaceErr(null);
    setFaceMsg(null);
    const fd = new FormData();
    if (targetId) fd.set("targetId", targetId);
    startTransition(async () => {
      const res = await clearStaffFaceAction(null, fd);
      if (res.ok) {
        setFaceMsg("Face biometric removed.");
        router.refresh();
      } else {
        setFaceErr(res.error);
      }
    });
  }

  return (
    <div className={compact ? "grid gap-4 sm:grid-cols-2" : "space-y-5"}>
      {/* ── ID photo ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-sm font-medium">ID photo</p>
        <IdPhotoPicker photoUrl={photoUrl} onPhoto={onPhoto} disabled={pending} />
        {photoErr ? <p className="text-xs text-destructive">{photoErr}</p> : null}
        {photoMsg ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {photoMsg}
          </p>
        ) : null}
      </div>

      {/* ── Face biometric ───────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Face biometric</p>
        <div className="flex items-center gap-2 text-xs">
          <Fingerprint className="h-4 w-4 text-primary" aria-hidden />
          {enrolledAt ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 font-medium text-success">
              <ShieldCheck className="h-3 w-3" aria-hidden /> Enrolled · {enrolledAt}
            </span>
          ) : (
            <span className="rounded-full bg-warning/10 px-2 py-0.5 font-medium text-warning">
              Not enrolled
            </span>
          )}
        </div>
        <FaceScan
          onDescriptor={onFace}
          requireLiveness
          label={enrolledAt ? "Re-capture face" : "Capture face biometric"}
        />
        <p className="text-xs text-muted-foreground">
          A live check (head turn + blink) proves a real person. Capturing again
          replaces the stored template — sign in with it using your staff code.
        </p>
        {enrolledAt ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={clearFace}
            disabled={pending}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove biometric
          </Button>
        ) : null}
        {faceErr ? <p className="text-xs text-destructive">{faceErr}</p> : null}
        {faceMsg ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {faceMsg}
          </p>
        ) : null}
      </div>
    </div>
  );
}
