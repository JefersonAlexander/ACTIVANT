import Link from "next/link";
import { Bell } from "lucide-react";
import { getNotificationCount } from "../services/queries";
export async function NotificationAccess() {
  const result = await getNotificationCount();
  const count = result.error ? null : result.count;
  return <Link href="/notificaciones" className="mb-5 flex min-h-12 items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm font-medium lg:mb-7" aria-label={count === null ? "Consultar notificaciones" : `Notificaciones: ${count} sin leer`}>
    <Bell className="size-5 shrink-0 text-primary" aria-hidden="true" /><span>Notificaciones y espera</span>
    {count !== null && count !== undefined && count > 0 && <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white" aria-hidden="true">{count > 99 ? "99+" : count}</span>}
  </Link>;
}
