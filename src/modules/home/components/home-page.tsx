import { ArrowDown, ArrowRight, Compass, Heart, Leaf, MoveUpRight, Sprout, UsersRound } from "lucide-react";
import { Container } from "@/components/shared/container";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WellbeingIllustration } from "./wellbeing-illustration";

// Contenido editorial de la portada. No corresponde a servicios ni programas publicados.
const principles = [
  { icon: Heart, number: "01", title: "Las personas, primero", description: "Un espacio pensado alrededor de las personas y de lo que significa sentirse bien en la vida cotidiana." },
  { icon: Leaf, number: "02", title: "Bienestar con propósito", description: "Una mirada integral al cuidado personal, los hábitos saludables y el equilibrio en nuestro día a día." },
  { icon: UsersRound, number: "03", title: "Una comunidad que conecta", description: "El bienestar también se construye juntos, desde el respeto, la cercanía y el sentido de pertenencia." },
] as const;

export function HomePage() {
  return <>
    <section className="relative border-y bg-secondary/35" aria-labelledby="welcome-title">
      <Container className="grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-[1.12fr_1fr] lg:gap-12 lg:py-20">
        <div>
          <p className="mb-6 flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-primary uppercase">
            <span className="h-px w-7 bg-primary" /> Bienvenidos a ACTIVANT
          </p>
          <h1 id="welcome-title" className="max-w-xl text-[clamp(2.7rem,5vw,4.5rem)] leading-[1.08] font-bold tracking-[-0.055em]">
            Tu bienestar,<br /><span className="text-primary">un buen comienzo.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Estamos construyendo un espacio para conectar con el bienestar institucional de la Gobernación de Antioquia.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg"><a href="#plataforma">Conoce el proyecto <ArrowRight aria-hidden="true" /></a></Button>
            <Button asChild variant="ghost" size="lg"><a href="#bienestar">Nuestro enfoque <ArrowDown aria-hidden="true" /></a></Button>
          </div>
          <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground"><Sprout className="size-4 text-primary" aria-hidden="true" /> Un primer paso hacia un bienestar compartido.</p>
        </div>
        <WellbeingIllustration />
      </Container>
    </section>

    <section id="bienestar" aria-labelledby="principles-title" className="scroll-mt-8 py-14 sm:py-20">
      <Container>
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <SectionHeading id="principles-title" eyebrow="Nuestra razón de ser" title="Cuidarnos también nos une." />
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">Una plataforma con las personas en el centro y el bienestar como punto de encuentro.</p>
        </div>
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {principles.map(({ icon: Icon, number, title, description }) => <Card key={number}>
            <CardHeader className="p-6 sm:p-7">
              <div className="mb-6 flex items-center justify-between">
                <span className="flex size-12 items-center justify-center rounded-full bg-primary text-white"><Icon className="size-6" aria-hidden="true" /></span>
                <span className="font-mono text-xs text-muted-foreground">{number}</span>
              </div>
              <CardTitle>{title}</CardTitle>
              <CardDescription className="pt-1">{description}</CardDescription>
            </CardHeader>
          </Card>)}
        </div>
      </Container>
    </section>

    <section id="plataforma" aria-labelledby="platform-title" className="scroll-mt-8 pb-16 sm:pb-20">
      <Container>
        <div className="grid overflow-hidden rounded-2xl border lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col items-start bg-secondary/60 p-7 sm:p-10">
            <Badge className="mb-6 bg-background"><span className="size-1.5 rounded-full bg-primary" /> En construcción</Badge>
            <h2 id="platform-title" className="max-w-sm text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">Un espacio que empieza a tomar forma.</h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">Esta es la primera versión de ACTIVANT. Estamos preparando la plataforma para acompañar el bienestar institucional.</p>
            <span className="mt-7 flex items-center gap-2 text-xs font-medium text-primary"><Compass className="size-4" aria-hidden="true" /> El bienestar es nuestro punto de partida.</span>
          </div>
          <div className="flex flex-col justify-center bg-card">
            <EmptyState icon={Sprout} title="Próximamente, más posibilidades" description="Todavía no hay programas o actividades publicados en esta plataforma. Aquí encontrarás novedades cuando están disponibles." />
            <div className="mx-7 mb-6 flex items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground sm:mx-10">
              <span>ACTIVANT · Bienestar institucional</span><MoveUpRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  </>;
}
