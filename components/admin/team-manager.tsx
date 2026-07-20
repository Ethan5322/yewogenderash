"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2, CheckCircle2, UserPlus, ShieldCheck, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createSubAdminAction,
  updatePermissionsAction,
  setSuperAdminAction,
  revokeAdminAction,
  type ActionResult,
} from "@/app/admin/team/actions";

type PermDef = [key: string, label: string];

export type AdminRowData = {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  permissions: Record<string, boolean>;
};

export function CreateAdminForm({ permissionDefs }: { permissionDefs: PermDef[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createSubAdminAction,
    null
  );
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="name" className="text-sm font-medium">Name</label>
          <Input id="name" name="name" className="mt-1.5" placeholder="Full name" />
        </div>
        <div>
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <Input id="email" name="email" type="email" className="mt-1.5" placeholder="admin@…" />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-medium">Temp password</label>
          <Input id="password" name="password" type="text" className="mt-1.5" placeholder="8+ chars, 1 number" />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Capabilities</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {permissionDefs.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
              <input type="checkbox" name={`perm_${key}`} className="h-4 w-4 accent-primary" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Sub-admin created
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" aria-hidden />}
        Create sub-admin
      </Button>
    </form>
  );
}

export function AdminRow({
  admin,
  permissionDefs,
  currentAdminId,
  currentIsSuper,
}: {
  admin: AdminRowData;
  permissionDefs: PermDef[];
  currentAdminId: string;
  currentIsSuper: boolean;
}) {
  const [perms, setPerms] = React.useState<Record<string, boolean>>(admin.permissions);
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);
  const isSelf = admin.id === currentAdminId;

  function run(fn: () => Promise<ActionResult>) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setMsg(res.error);
    });
  }

  function savePerms() {
    const fd = new FormData();
    fd.set("targetId", admin.id);
    for (const [key] of permissionDefs) if (perms[key]) fd.set(`perm_${key}`, "on");
    run(() => updatePermissionsAction(null, fd));
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold">{admin.name}</p>
            {admin.isSuperAdmin ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold">
                <Crown className="h-3 w-3" aria-hidden /> Main admin
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                <ShieldCheck className="h-3 w-3" aria-hidden /> Sub-admin
              </span>
            )}
            {isSelf ? <span className="text-xs text-muted-foreground">(you)</span> : null}
          </div>
          <p className="text-sm text-muted-foreground">{admin.email}</p>
        </div>

        {currentIsSuper && !isSelf ? (
          <div className="flex flex-wrap gap-2">
            {admin.isSuperAdmin ? (
              <Button size="sm" variant="outline" disabled={pending}
                onClick={() => run(() => setSuperAdminAction(admin.id, false))}>
                Step down to sub-admin
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled={pending}
                onClick={() => run(() => setSuperAdminAction(admin.id, true))}>
                <Crown className="h-3.5 w-3.5" aria-hidden /> Make main admin
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={pending}
              className="text-destructive hover:text-destructive"
              onClick={() => run(() => revokeAdminAction(admin.id))}>
              Remove
            </Button>
          </div>
        ) : null}
      </div>

      {/* Capability toggles (super admins hold all implicitly) */}
      {admin.isSuperAdmin ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Holds every capability, and can manage other admins.
        </p>
      ) : (
        <div className="mt-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {permissionDefs.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={!!perms[key]}
                  onChange={(e) => setPerms((p) => ({ ...p, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
          <Button size="sm" className="mt-3" disabled={pending} onClick={savePerms}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save capabilities
          </Button>
        </div>
      )}

      {msg ? <p className="mt-3 text-sm text-destructive">{msg}</p> : null}
    </div>
  );
}
