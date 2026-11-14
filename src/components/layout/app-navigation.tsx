"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BookOpen, CalendarDays, ChartNoAxesCombined, ClipboardCheck, Dumbbell, History, House, LayoutDashboard, Menu, Ticket, UserRound, Users, Settings2, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/modules/auth/permissions";
import { getNavigation } from "@/config/navigation";
import { cn } from "@/lib/utils";

const icons = { settings: Settings2, shield: ShieldCheck, bell: Bell, home: House, gym: Dumbbell, history: History, library: BookOpen, profile: UserRound, admin: LayoutDashboard, users: Users, calendar: CalendarDays, bookings: Ticket, reports: ChartNoAxesCombined, attendance: ClipboardCheck };
export function AppNavigation({ roles }: { roles: AppRole[] }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const items = getNavigation(roles);
  return <>
    <Button className="lg:hidden" variant="outline" aria-expanded={expanded} aria-controls="app-navigation" onClick={() => setExpanded(!expanded)}>
      {expanded ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}{expanded ? "Cerrar menú" : "Menú"}
    </Button>
    <nav id="app-navigation" aria-label="Navegación de ACTIVANT" className={cn("absolute inset-x-0 top-full z-30 max-h-[75dvh] overflow-y-auto border-b bg-white p-4 shadow-sm lg:static lg:mt-8 lg:block lg:shrink-0 lg:max-h-none lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none", !expanded && "hidden")}>
      {(["Tu espacio", "Gestión"] as const).map((group) => {
        const entries = items.filter((item) => item.group === group);
        return entries.length > 0 && <div key={group} className="mb-6 last:mb-0">
          <p className="mb-2 px-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">{group}</p>
          <ul className="space-y-1">{entries.map((item) => {
            const Icon = icons[item.icon];
            const current = pathname === item.href;
            return <li key={item.href}><Link href={item.href} onClick={() => setExpanded(false)} aria-current={current ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary", current ? "bg-secondary text-primary" : "text-muted-foreground")}>
              <Icon className="size-[18px] shrink-0" aria-hidden="true" />{item.label}
            </Link></li>;
          })}</ul>
        </div>;
      })}
    </nav>
  </>;
}
