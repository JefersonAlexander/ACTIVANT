import type { ReactNode } from "react";
import { ArrowLeft, Leaf, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/shared/brand";
import { Container } from "@/components/shared/container";
import { Card } from "@/components/ui/card";

type AuthShellProps = { title: string; description: string; children: ReactNode };

export function AuthShell({ title, description, children }: AuthShellProps) {
  return <section aria-labelledby="auth-title" className="border-y bg-secondary/35 py-10 sm:py-16">
    <Container>
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-2xl border bg-background shadow-sm lg:grid-cols-[0.95fr_1.05fr]">
        <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
          <div>
            <span className="inline-flex size-12 items-center justify-center rounded-xl border border-white/25"><Leaf className="size-6" aria-hidden="true" /></span>
            <p className="mt-12 text-xs font-semibold tracking-[0.16em] uppercase">Bienestar institucional</p>
            <p className="mt-5 text-4xl leading-tight font-semibold tracking-tight">Un espacio para<br />cuidarnos y conectar.</p>
            <p className="mt-6 max-w-xs text-sm leading-7 text-white/90">Tu bienestar también hace parte de lo que construimos juntos en Antioquia.</p>
          </div>
          <div aria-hidden="true" className="relative my-8 h-20">
            <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
            <div className="absolute inset-x-5 top-5 h-px bg-white/15" />
            <div className="absolute inset-x-10 top-10 h-px bg-white/10" />
            <div className="absolute right-4 -top-7 flex size-16 items-center justify-center rounded-full border border-white/30 bg-primary"><Leaf className="size-7" /></div>
          </div>
          <p className="flex items-center gap-2 text-xs text-white/90"><ShieldCheck className="size-4" aria-hidden="true" /> Acceso institucional por invitación</p>
        </div>
        <Card className="rounded-none border-0 p-6 shadow-none sm:p-10 lg:p-12">
          <Brand />
          <h1 id="auth-title" className="mt-8 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-8 border-t pt-5">
            <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" aria-hidden="true" /> Volver al inicio</Link>
          </div>
        </Card>
      </div>
    </Container>
  </section>;
}
