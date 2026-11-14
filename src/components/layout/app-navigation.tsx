"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BookOpen, CalendarDays, ChartNoAxesCombined, ClipboardCheck, Dumbbell, History, House, LayoutDashboard, Menu, Ticket, UserRound, Users, Settings2, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/modules/auth/permissions";
import { getNavigation } from "@/config/navigation";
import { cn } from "@/lib/utils";

const icons = { settings: Settings2, shield: ShieldCheck, bell: Bell, home: House, gym: Dumbbell, history: History, library: BookOpen, profile: UserRound, admin: LayoutDashboard, users: Users, calendar: CalendarDays, bookings: Ticket, reports: ChartNoAxesCombined, attendance: ClipboardCheck };
const shortcuts = new Set(["home", "gym", "library", "profile"]);
export function AppNavigation({ roles }: { roles: AppRole[] }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState(false);
  const items = getNavigation(roles);
  function close() { dialog.current?.close(); }
  return <>
    <nav aria-label="Accesos principales" className="fixed top-1/2 right-2 z-40 flex max-h-[calc(100dvh-2rem)] w-14 -translate-y-1/2 flex-col items-center gap-2 rounded-[2rem] border border-white bg-white py-4 shadow-float sm:right-4 sm:w-18 sm:gap-4 sm:py-6 lg:right-6 lg:w-20">
      {items.filter(item => shortcuts.has(item.icon) && item.group === "Tu espacio").map(item => {
        const Icon = icons[item.icon];
        const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return <Link key={item.href} href={item.href} title={item.label} aria-label={item.label} aria-current={current ? "page" : undefined} className={cn("relative flex size-11 items-center justify-center rounded-2xl transition-colors hover:bg-secondary hover:text-primary sm:size-12", current ? "bg-secondary/70 text-primary" : "text-muted-foreground")}>
          <Icon className="size-7 sm:size-8" strokeWidth={1.8} aria-hidden="true" />
          {current && <span aria-hidden="true" className="absolute top-2 -right-1 bottom-2 w-1 rounded-full bg-primary sm:-right-3" />}
        </Link>;
      })}
      <Button variant="ghost" className="h-auto flex-col gap-0.5 px-1 py-1 text-xs text-forest [&_svg]:size-5" aria-expanded={expanded} aria-controls="app-navigation" onClick={() => { dialog.current?.showModal(); setExpanded(true); }}><Menu aria-hidden="true" />Menú</Button>
    </nav>
    <dialog ref={dialog} aria-label="Todas las secciones de ACTIVANT" onClose={() => setExpanded(false)} onClick={event => { if (event.target === event.currentTarget) close(); }} className="fixed inset-y-3 right-3 left-auto m-0 ml-auto h-[calc(100dvh-1.5rem)] max-h-none w-[calc(100%_-_1.5rem)] max-w-sm overflow-y-auto rounded-3xl border border-white bg-white p-6 text-foreground shadow-float backdrop:bg-forest/35">
      <div className="mb-6 flex items-center justify-between gap-3"><p className="text-lg font-bold">Tu espacio ACTIVANT</p><Button variant="ghost" size="icon" aria-label="Cerrar menú" aria-expanded={expanded} aria-controls="app-navigation" onClick={close}><X aria-hidden="true" /></Button></div>
    <nav id="app-navigation" aria-label="Navegación de ACTIVANT">
      {(["Tu espacio", "Gestión"] as const).map((group) => {
        const entries = items.filter((item) => item.group === group);
        return entries.length > 0 && <div key={group} className="mb-6 last:mb-0">
          <p className="mb-2 px-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">{group}</p>
          <ul className="space-y-1">{entries.map((item) => {
            const Icon = icons[item.icon];
            const current = pathname === item.href;
            return <li key={item.href}><Link href={item.href} onClick={close} aria-current={current ? "page" : undefined} className={cn("flex min-h-12 items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary", current ? "bg-forest text-white hover:bg-forest/90" : "text-forest")}>
              <Icon className="size-[18px] shrink-0" aria-hidden="true" />{item.label}
            </Link></li>;
          })}</ul>
        </div>;
      })}
    </nav>
    </dialog>
  </>;
}
