export const authCookieOptions = {
  name: "activant-auth",
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 7,
};

export function isAuthCookie(name: string): boolean {
  return name === authCookieOptions.name ||
    name.startsWith(`${authCookieOptions.name}.`) ||
    name.startsWith(`${authCookieOptions.name}-`);
}
