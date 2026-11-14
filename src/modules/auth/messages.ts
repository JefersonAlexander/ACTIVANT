export const authMessages: Record<string, string> = {
  "sesion-expirada": "Tu sesión terminó. Inicia sesión nuevamente para continuar.",
  "sesion-cerrada": "Cerraste sesión correctamente.",
  "contrasena-actualizada": "Tu contraseña se actualizó. Inicia sesión con tu nueva contraseña.",
  "enlace-invalido": "El enlace no es válido, ya se utilizó o ha expirado. Solicita uno nuevo.",
  "servicio-no-disponible": "No pudimos conectar con el servicio de acceso. Intenta nuevamente en unos minutos.",
  "configuracion-no-disponible": "El acceso aún no está habilitado. Intenta más tarde.",
};

export function authErrorMessage(error: { code?: string; status?: number } | null): string {
  if (error?.status === 429 || error?.code === "over_request_rate_limit" || error?.code === "over_email_send_rate_limit") {
    return "Has realizado varios intentos. Espera unos minutos antes de volver a intentarlo.";
  }
  if (error?.code === "invalid_credentials" || error?.code === "email_not_confirmed" || error?.status === 400 || error?.status === 401) {
    return "No pudimos iniciar sesión. Verifica tu correo y contraseña.";
  }
  return "No pudimos completar la solicitud. Intenta nuevamente en unos minutos.";
}

export type AuthFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Partial<Record<"email" | "password" | "confirmPassword", string[]>>;
};
export const initialAuthState: AuthFormState = { status: "idle" };

export function getAuthNotice(value: unknown): string | undefined {
  return typeof value === "string" && Object.hasOwn(authMessages, value) ? authMessages[value] : undefined;
}
