"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileDropzone } from "@/components/onboarding/file-dropzone";
import { saveDocumentsAction, type ActionResult } from "@/app/(public)/start/(wizard)/actions";

const selectClass =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SUPPORTING_TYPES = [
  { value: "MEDICAL_LETTER", label: "Medical letter / treatment estimate" },
  { value: "EDUCATION_LETTER", label: "School / admission letter" },
  { value: "COMMUNITY_LETTER", label: "NGO / local authority letter" },
  { value: "BUSINESS_REGISTRATION", label: "Business registration / permit" },
  { value: "PROOF_OF_ADDRESS", label: "Proof of address" },
  { value: "OTHER_SUPPORTING", label: "Other supporting document" },
] as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function DocumentsForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveDocumentsAction,
    null
  );
  const [accountType, setAccountType] = React.useState("BANK");
  const [primaryFile, setPrimaryFile] = React.useState<File | null>(null);
  const [supportingFile, setSupportingFile] = React.useState<File | null>(null);

  const ready = !!primaryFile && !!supportingFile;

  return (
    <form action={action} className="space-y-8">
      {/* Identity */}
      <fieldset className="space-y-4">
        <legend className="font-display text-base font-semibold">Your identity</legend>
        <Field label="National ID or passport number">
          <Input name="idNumber" placeholder="e.g. 1234567890" required />
        </Field>
      </fieldset>

      {/* Payout */}
      <fieldset className="space-y-4">
        <legend className="font-display text-base font-semibold">Payout account</legend>
        <p className="-mt-2 text-sm text-muted-foreground">
          Where approved funds will be sent. Visible only to administrators.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Method">
            <select
              name="accountType"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className={selectClass}
            >
              <option value="BANK">Bank account</option>
              <option value="TELEBIRR">Telebirr</option>
            </select>
          </Field>
          <Field label="Account holder name">
            <Input name="accountName" required />
          </Field>
          <Field label={accountType === "TELEBIRR" ? "Telebirr number" : "Account number"}>
            <Input name="accountNumber" required />
          </Field>
          {accountType === "BANK" ? (
            <Field label="Bank name">
              <Input name="bankName" placeholder="e.g. Commercial Bank of Ethiopia" />
            </Field>
          ) : (
            <input type="hidden" name="bankName" value="" />
          )}
        </div>
      </fieldset>

      {/* Documents */}
      <fieldset className="space-y-4">
        <legend className="font-display text-base font-semibold">Documents</legend>
        <div className="grid gap-4">
          <Field label="Primary ID type">
            <select name="primaryIdType" className={selectClass} defaultValue="NATIONAL_ID">
              <option value="NATIONAL_ID">National ID</option>
              <option value="PASSPORT">Passport</option>
            </select>
          </Field>
          <FileDropzone
            name="primaryIdFile"
            label="Upload your ID document"
            file={primaryFile}
            onFileChange={setPrimaryFile}
          />

          <Field label="Supporting document type">
            <select name="supportingType" className={selectClass} defaultValue="MEDICAL_LETTER">
              {SUPPORTING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <FileDropzone
            name="supportingFile"
            label="Upload your supporting document"
            file={supportingFile}
            onFileChange={setSupportingFile}
          />
        </div>
      </fieldset>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden />
        Documents are stored privately and seen only by authorised administrators.
      </div>

      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={!ready || pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save &amp; continue <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </form>
  );
}
