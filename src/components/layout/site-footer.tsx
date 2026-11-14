import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/shared/brand";
import { Container } from "@/components/shared/container";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return <footer className="mt-auto border-t bg-background">
    <Container className="flex flex-col justify-between gap-6 py-8 sm:flex-row sm:items-center">
      <div className="space-y-2"><Brand /><p className="text-xs text-muted-foreground">Bienestar que nos conecta.</p></div>
      <div className="space-y-2 text-sm text-muted-foreground sm:text-right">
        <p>{siteConfig.institution}</p>
        <Link className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-xs hover:text-primary" href="/#plataforma">
          Plataforma en construcción <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </Container>
  </footer>;
}
