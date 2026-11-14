import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/shared/brand";
import { InstitutionLogo } from "@/components/shared/institution-logo";
import { Container } from "@/components/shared/container";

export function SiteFooter() {
  return <footer className="mt-auto border-t border-white bg-white shadow-[0_-8px_24px_-16px_rgb(5_73_54_/_20%)]">
    <Container className="flex flex-col justify-between gap-6 py-8 sm:flex-row sm:items-center">
      <div className="space-y-2"><Brand /><p className="text-xs text-muted-foreground">Bienestar que nos conecta.</p></div>
      <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground sm:items-end sm:text-right">
        <InstitutionLogo />
        <Link className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-xs hover:text-primary" href="/#plataforma">
          Plataforma en construcción <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </Container>
  </footer>;
}
