import Link from "next/link";
import { Brand } from "@/components/shared/brand";
import { InstitutionLogo } from "@/components/shared/institution-logo";
import { AppNavigation } from "./app-navigation";
import { LogoutButton } from "@/modules/auth";
import type { requireViewer } from "@/modules/auth/server";
import { ActivityRefresh } from "@/modules/waitlist/components/activity-refresh";
import { NotificationAccess } from "@/modules/waitlist/components/notification-access";

type Viewer = Awaited<ReturnType<typeof requireViewer>>;
export function AppShell({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background">
    <ActivityRefresh userId={viewer.user.id} />
    <AppNavigation roles={viewer.roles} />
    <div className="app-content mx-auto min-w-0 max-w-[1440px]">
      <header className="flex min-h-24 flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8 xl:px-10">
        <Brand href="/dashboard" ariaLabel="ACTIVANT, mi bienestar" preload />
        <Link href="/perfil" className="flex min-h-12 min-w-0 max-w-full items-center gap-3 rounded-full bg-white p-2 pr-4 text-sm font-medium shadow-soft sm:max-w-xs">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary font-bold text-primary" aria-hidden="true">{(viewer.user.email?.[0] ?? "A").toUpperCase()}</span><span className="truncate">{viewer.user.email ?? "Mi perfil"}</span>
        </Link>
      </header>
      <main id="contenido" tabIndex={-1} className="mx-auto max-w-[1440px] px-4 py-7 focus:outline-none sm:px-6 sm:py-8 lg:px-8 xl:px-10 xl:py-10"><NotificationAccess />{children}</main>
      <footer className="mx-4 mb-5 flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-white bg-white p-6 text-xs text-muted-foreground shadow-soft sm:mx-6 lg:mx-8 xl:mx-10"><Brand /><InstitutionLogo /><LogoutButton /></footer>
    </div>
  </div>;
}
