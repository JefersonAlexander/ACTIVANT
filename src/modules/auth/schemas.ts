import { z } from "zod";

const email = z.string().trim().toLowerCase().max(254).pipe(z.email("Ingresa un correo electrónico válido."));
export const loginSchema = z.object({
  email,
  // No aplicar la política nueva a contraseñas de cuentas existentes.
  password: z.string().min(1, "Ingresa tu contraseña.").max(128, "La contraseña es demasiado larga."),
});
export const recoverySchema = z.object({ email });
export const passwordSchema = z.object({
  password: z.string().min(12, "Usa al menos 12 caracteres.").max(128, "Usa máximo 128 caracteres."),
  confirmPassword: z.string().min(1, "Confirma la nueva contraseña."),
}).refine((value) => value.password === value.confirmPassword, {
  message: "Las contraseñas no coinciden.", path: ["confirmPassword"],
});

export const callbackSchema = z.union([
  z.object({ code: z.string().min(1).max(2048), sb_flow_id: z.string().regex(/^[a-zA-Z0-9_-]{8,64}$/).optional() }),
  z.object({ token_hash: z.string().min(1).max(2048), type: z.enum(["recovery", "invite"]) }),
]);
