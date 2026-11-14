import type { ReactNode } from "react";
import { requireViewer } from "@/modules/auth/server";
import { SessionGuard } from "@/modules/auth";
import { AppShell } from "@/components/layout/app-shell";
export const dynamic = "force-dynamic";
export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();
  return <AppShell viewer={viewer}><SessionGuard />{children}</AppShell>;
}
