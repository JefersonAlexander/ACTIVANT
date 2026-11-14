"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export function ActivityRefresh({ userId }: { userId: string }) {
  const router = useRouter();
  useEffect(() => {
    const client = createClient();
    let debounce: number | undefined;
    let subscribed = false;
    const refresh = () => {
      if (document.visibilityState !== "visible" || debounce !== undefined) return;
      debounce = window.setTimeout(() => {
        debounce = undefined;
        if (!document.querySelector('[aria-busy="true"], dialog[open]')) router.refresh();
      }, 600);
    };
    // RLS autoriza cada fila. El filtro reduce tráfico; no concede permisos.
    const channel = client.channel(`activant-activity:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "gym_availability_signals" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist_offers", filter: `user_id=eq.${userId}` }, refresh)
      .subscribe(status => { if (status === "SUBSCRIBED") { if (subscribed) refresh(); subscribed = true; } });
    // Recupera eventos perdidos y mantiene operativa la app sin WebSocket.
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer); window.clearTimeout(debounce);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      void client.removeChannel(channel);
    };
  }, [router, userId]);
  return null;
}
