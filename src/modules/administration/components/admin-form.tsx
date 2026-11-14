"use client";
import { useActionState, useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mutateAdministration, inviteUser } from "../actions";
import { initialActionState } from "@/modules/library/contracts";
export const selectClass = "min-h-12 w-full min-w-0 rounded-lg border bg-white px-3 text-sm";
export function AdminForm({ operation, children, label, disabled = false, invitation = false }: { operation?: string; children: ReactNode; label: string; disabled?: boolean; invitation?: boolean }) {
  const [state, action, pending] = useActionState(invitation ? inviteUser : mutateAdministration, initialActionState);
  return <form action={action} aria-busy={pending} className="space-y-4">{operation && <input type="hidden" name="operation" value={operation} />}<fieldset disabled={disabled || pending} className="min-w-0 space-y-4">{children}<Button type="submit" disabled={disabled || pending}>{pending ? "Guardando…" : label}</Button></fieldset>{state.message && <p role={state.status === "error" ? "alert" : "status"} className={`rounded-lg border p-3 text-sm leading-relaxed ${state.status === "error" ? "text-destructive" : "bg-secondary text-primary"}`}>{state.message}</p>}</form>;
}
export function AdminField({ name, label, type = "text", value, required = true }: { name: string; label: string; type?: string; value?: string | number; required?: boolean }) {
  const id = useId(); return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} name={name} type={type} defaultValue={value} required={required} /></div>;
}
export function AdminSelect({ name, label, value, children }: { name: string; label: string; value: string; children: ReactNode }) {
  const id = useId(); return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><select id={id} name={name} defaultValue={value} className={selectClass}>{children}</select></div>;
}
