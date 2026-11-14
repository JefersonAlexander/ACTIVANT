import Link from "next/link";
import { ArrowUpRight, CircleAlert, Info, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshButton } from "./refresh-button";
import { navigation } from "@/config/navigation";

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-5 sm:mb-8 sm:flex-row sm:items-end"><div className="min-w-0">{eyebrow && <p className="mb-2 break-words text-sm font-medium text-primary">{eyebrow}</p>}<h1 className="break-words text-[1.75rem] leading-tight font-semibold tracking-tight sm:text-3xl xl:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p></div>{action && <div className="shrink-0">{action}</div>}</div>;
}
export function Panel({ title, description, action, children, className = "" }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <Card role="region" aria-label={title} className={`overflow-hidden ${className}`}><div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6"><div><h2 className="text-lg font-semibold tracking-tight">{title}</h2>{description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}</div>{action}</div><div className="p-5 sm:p-6">{children}</div></Card>;
}
export function ReadError({ message }: { message: string }) {
  return <div role="alert" className="space-y-3 rounded-lg border border-destructive/25 bg-white p-4 text-sm"><p className="flex items-start gap-2 text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{message}</p><RefreshButton /></div>;
}
export function QuietEmpty({ title, description, icon: Icon }: { title: string; description: string; icon: LucideIcon }) {
  return <div className="rounded-xl bg-muted px-5 py-7"><Icon className="mb-4 size-6 text-primary" aria-hidden="true" /><p className="font-semibold">{title}</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div>;
}
export function ModuleNotice({ children }: { children: React.ReactNode }) {
  return <div role="note" className="flex items-start gap-3 rounded-xl border border-border bg-secondary/50 p-4 text-sm leading-relaxed"><Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><p>{children}</p></div>;
}
export function MetricCard({ label, value, description, icon: Icon, error }: { label: string; value: number | null; description: string; icon: LucideIcon; error?: string | null }) {
  return <Card className="p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium text-muted-foreground">{label}</h2><span className="rounded-lg bg-secondary p-2 text-primary"><Icon className="size-5" aria-hidden="true" /></span></div><p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value === null ? <span aria-label="No disponible">—</span> : new Intl.NumberFormat("es-CO").format(value)}</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{error ? "No disponible. Actualiza para volver a consultar." : description}</p></Card>;
}
export function DestinationLink({ href, description }: { href: string; description: string }) {
  const item = navigation.find((entry) => entry.href === href);
  if (!item) return null;
  return <Link href={item.href} className="group flex min-h-20 items-center justify-between gap-4 rounded-xl border bg-white p-5 transition-colors hover:border-primary hover:bg-secondary/40"><div><p className="font-semibold">{item.label}</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p></div><ArrowUpRight className="size-5 shrink-0 text-primary" aria-hidden="true" /></Link>;
}
export function PendingBadge() { return <Badge variant="outline">Próximamente</Badge>; }
