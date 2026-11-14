import Link from "next/link";
import { Activity, Heart } from "lucide-react";
import { AppNavigation } from "./app-navigation";
import { LogoutButton } from "@/modules/auth";
import type { requireViewer } from "@/modules/auth/server";
import { ActivityRefresh } from "@/modules/waitlist/components/activity-refresh";
import { NotificationAccess } from "@/modules/waitlist/components/notification-access";

type Viewer = Awaited<ReturnType<typeof requireViewer>>;
export function AppShell({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  return <div className="min-h-dvh bg-muted lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
    <ActivityRefresh userId={viewer.user.id} />
    <aside className="sticky top-0 z-30 flex h-fit items-center justify-between border-b bg-white px-5 py-4 lg:h-dvh lg:overflow-y-auto lg:flex-col lg:items-stretch lg:justify-start lg:border-r lg:border-b-0 lg:px-5 lg:py-7">
      <Link href="/dashboard" aria-label="ACTIVANT, mi bienestar" className="inline-flex min-h-11 items-center gap-2.5 rounded-lg lg:px-2">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white"><Activity className="size-6" aria-hidden="true" /></span>
        <span className="text-xl font-extrabold tracking-[-0.06em]">ACTIV<span className="text-primary">ANT</span></span>
      </Link>
      <AppNavigation roles={viewer.roles} />
      <div className="mt-auto hidden shrink-0 space-y-5 pt-8 lg:block">
        <div className="rounded-xl bg-muted p-4"><Heart className="mb-2 size-5 text-primary" aria-hidden="true" /><p className="text-sm font-medium">Tu bienestar cuenta.</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Un espacio para cuidarte y seguir avanzando.</p></div>
        <LogoutButton />
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">Gobernación de Antioquia<br />Bienestar institucional</p>
      </div>
    </aside>
    <div className="min-w-0">
      <header className="hidden min-h-20 items-center justify-between gap-4 border-b bg-white px-8 lg:flex xl:px-10">
        <p className="text-sm text-muted-foreground">Gobernación de Antioquia <span className="mx-2 text-border">/</span> Bienestar institucional</p>
        <Link href="/perfil" className="flex min-h-11 min-w-0 max-w-xs items-center gap-3 rounded-lg text-sm font-medium">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary" aria-hidden="true">{(viewer.user.email?.[0] ?? "A").toUpperCase()}</span><span className="truncate">{viewer.user.email ?? "Mi perfil"}</span>
        </Link>
      </header>
      <main id="contenido" tabIndex={-1} className="mx-auto max-w-[1440px] px-4 py-7 focus:outline-none sm:px-6 sm:py-8 lg:px-8 xl:px-10 xl:py-10"><NotificationAccess />{children}</main>
      <footer className="mx-4 flex flex-wrap items-center justify-between gap-4 border-t py-6 text-xs text-muted-foreground sm:mx-6 lg:mx-8 xl:mx-10"><p>ACTIVANT · Bienestar institucional</p><span className="lg:hidden"><LogoutButton /></span><span>Hecho para cuidarnos.</span></footer>
    </div>
  </div>;
}
