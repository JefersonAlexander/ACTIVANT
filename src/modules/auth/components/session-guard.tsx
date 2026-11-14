"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Mejora la experiencia ante expiración o cierre en otra pestaña. La autorización
// real sigue ejecutándose en el servidor en cada render y acción protegidos.
export function SessionGuard() {
  const router = useRouter();
  useEffect(() => {
    const client = createClient();
    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/login?estado=sesion-expirada");
        router.refresh();
      }
    });
    const verify = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = window.setInterval(verify, 60_000);
    window.addEventListener("focus", verify);
    return () => {
      subscription.unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener("focus", verify);
    };
  }, [router]);
  return null;
}
