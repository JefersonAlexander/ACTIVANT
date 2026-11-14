import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/login", "/recuperar-contrasena", "/actualizar-contrasena", "/acceso-denegado", "/dashboard/:path*", "/gimnasio/:path*", "/historial/:path*", "/biblioteca/:path*", "/perfil/:path*", "/admin/:path*", "/control-asistencia/:path*", "/asistencia/:path*", "/constancia/:path*", "/notificaciones/:path*", "/auth/:path*"],
};
