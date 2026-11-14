"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, recoverPassword, updatePassword } from "../actions";
import { initialAuthState, type AuthFormState } from "../messages";

function Feedback({ state }: { state: AuthFormState }) {
  if (!state.message) return null;
  return <p role={state.status === "error" ? "alert" : "status"}
    className={`rounded-lg border p-3 text-sm leading-6 ${state.status === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-primary/20 bg-secondary text-secondary-foreground"}`}>
    {state.message}
  </p>;
}

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return <p id={id} className="mt-2 text-sm text-destructive">{errors[0]}</p>;
}

function PasswordField({ id, label, errors, newPassword = false, disabled }: {
  id: string; label: string; errors?: string[]; newPassword?: boolean; disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return <div className="space-y-2.5">
    <Label htmlFor={id}>{label}</Label>
    <div className="relative">
      <LockKeyhole className="pointer-events-none absolute top-4 left-3 size-4 text-muted-foreground" aria-hidden="true" />
      <Input id={id} name={id} type={visible ? "text" : "password"} autoComplete={newPassword ? "new-password" : "current-password"}
        required maxLength={128} minLength={newPassword ? 12 : 1} disabled={disabled} className="pr-12 pl-10"
        aria-invalid={Boolean(errors?.length)} aria-describedby={errors?.length ? `${id}-error` : newPassword ? "password-hint" : undefined} />
      <button type="button" onClick={() => setVisible(!visible)} disabled={disabled} aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
        aria-pressed={visible} className="absolute top-0 right-0 flex size-12 items-center justify-center rounded-lg text-muted-foreground hover:text-primary disabled:opacity-50">
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
    <FieldError id={`${id}-error`} errors={errors} />
  </div>;
}

function EmailField({ errors, disabled }: { errors?: string[]; disabled?: boolean }) {
  return <div className="space-y-2.5">
    <Label htmlFor="email">Correo electrónico</Label>
    <div className="relative">
      <Mail className="pointer-events-none absolute top-4 left-3 size-4 text-muted-foreground" aria-hidden="true" />
      <Input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} inputMode="email"
        required maxLength={254} disabled={disabled} placeholder="Tu correo institucional" className="pl-10"
        aria-invalid={Boolean(errors?.length)} aria-describedby={errors?.length ? "email-error" : undefined} />
    </div>
    <FieldError id="email-error" errors={errors} />
  </div>;
}

function Submit({ pending, disabled, children }: { pending: boolean; disabled?: boolean; children: React.ReactNode }) {
  return <Button type="submit" size="lg" className="w-full" disabled={pending || disabled}>
    {pending ? <><LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Procesando…</> : <>{children}<ArrowRight aria-hidden="true" /></>}
  </Button>;
}

export function LoginForm({ configured, notice }: { configured: boolean; notice?: string }) {
  const [state, action, pending] = useActionState(login, initialAuthState);
  return <form action={action} className="space-y-5" aria-busy={pending}>
    {notice && state.status === "idle" && <p role="status" className="rounded-lg border bg-muted p-3 text-sm leading-6">{notice}</p>}
    {!configured && <p role="status" className="rounded-lg border bg-muted p-3 text-sm leading-6">El acceso aún no está habilitado. Intenta más tarde.</p>}
    <EmailField errors={state.errors?.email} disabled={!configured || pending} />
    <PasswordField id="password" label="Contraseña" errors={state.errors?.password} disabled={!configured || pending} />
    <div className="flex justify-end"><Link href="/recuperar-contrasena" className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline">¿Olvidaste tu contraseña?</Link></div>
    <Feedback state={state} />
    <Submit pending={pending} disabled={!configured}>Iniciar sesión</Submit>
    <p className="text-center text-xs leading-6 text-muted-foreground">El acceso es asignado por el administrador institucional.<br />Si aún no tienes una cuenta, comunícate con él.</p>
  </form>;
}

export function RecoveryForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(recoverPassword, initialAuthState);
  return <form action={action} className="space-y-5" aria-busy={pending}>
    {!configured && <p role="status" className="rounded-lg border bg-muted p-3 text-sm leading-6">La recuperación aún no está disponible. Intenta más tarde.</p>}
    <EmailField errors={state.errors?.email} disabled={!configured || pending || state.status === "success"} />
    <Feedback state={state} />
    {state.status !== "success" && <Submit pending={pending} disabled={!configured}>Enviar enlace</Submit>}
    <Link href="/login" className="flex min-h-11 items-center justify-center rounded-sm text-sm font-medium text-primary hover:underline">Volver a iniciar sesión</Link>
  </form>;
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initialAuthState);
  return <form action={action} className="space-y-5" aria-busy={pending}>
    <PasswordField id="password" label="Nueva contraseña" errors={state.errors?.password} newPassword disabled={pending} />
    <p id="password-hint" className="text-xs leading-5 text-muted-foreground">Usa entre 12 y 128 caracteres. Prefiere una frase larga y única.</p>
    <PasswordField id="confirmPassword" label="Confirmar contraseña" errors={state.errors?.confirmPassword} newPassword disabled={pending} />
    <Feedback state={state} />
    <Submit pending={pending}>Guardar contraseña</Submit>
    <Link href="/recuperar-contrasena" className="flex min-h-11 items-center justify-center rounded-sm text-sm text-primary hover:underline">Solicitar otro enlace</Link>
  </form>;
}
