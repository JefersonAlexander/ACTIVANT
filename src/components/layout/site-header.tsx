import { LogIn, Sprout } from "lucide-react";
import { Brand } from "@/components/shared/brand";
import { Container } from "@/components/shared/container";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return <header className="bg-background">
    <div className="border-b border-mint/30 bg-white/60">
      <Container className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5 text-xs text-muted-foreground">
        <span>{siteConfig.institution}</span>
        <span className="flex items-center gap-1.5"><Sprout className="size-3.5" aria-hidden="true" /> Bienestar institucional</span>
      </Container>
    </div>
    <Container className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 py-5">
      <Brand preload />
      <nav aria-label="Navegación principal" className="order-3 flex w-full flex-wrap items-center justify-center gap-x-5 gap-y-1 rounded-full border border-white bg-white px-5 py-1 shadow-soft md:order-0 md:w-auto">
        {siteConfig.navigation.map((item, index) => <a key={item.href} href={item.href}
          className={`flex min-h-11 items-center rounded-sm text-sm font-medium transition-colors hover:text-primary ${index === 0 ? "text-primary" : "text-muted-foreground"}`}>
          {item.label}
        </a>)}
      </nav>
      <Button asChild variant="outline" size="sm"><Link href="/login"><LogIn aria-hidden="true" /> Ingresar</Link></Button>
    </Container>
  </header>;
}
