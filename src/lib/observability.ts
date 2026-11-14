export function safeErrorEvent(error: unknown, routePattern: string, routeType: string) {
  const digest = typeof error === "object" && error !== null && "digest" in error && /^\d{1,32}$/.test(String(error.digest)) ? String(error.digest) : undefined;
  // Patrón de Next, nunca request.path, query string, cabeceras o argumentos RPC.
  const route = /^\/[a-zA-Z0-9_/\[\].-]{0,150}$/.test(routePattern) ? routePattern : "unrecognized";
  const type = ["render","route","action","proxy"].includes(routeType) ? routeType : "unknown";
  return { event: "activant.server_error", route, type, ...(digest ? { digest } : {}) };
}
