import { z } from "zod";

export const appUrlSchema = z.url().pipe(z.string().refine((value) => {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return (url.protocol === "https:" || (local && url.protocol === "http:")) &&
    url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password;
}, "APP_URL debe ser el origen público HTTPS o una dirección HTTP local."));

export function getAppOrigin(): string {
  const result = appUrlSchema.safeParse(process.env.APP_URL);
  if (!result.success) throw new Error("Configura APP_URL con el origen del aplicativo.");
  return new URL(result.data).origin;
}
