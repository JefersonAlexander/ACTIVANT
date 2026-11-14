import type { Instrumentation } from "next";
import { deploymentIssues } from "./lib/deployment";
import { safeErrorEvent } from "./lib/observability";
export function register() {
  if (process.env.APP_ENV === "production") {
    const issues = deploymentIssues(process.env);
    if (issues.length) throw new Error(`Configuración de producción inválida: ${issues.join(", ")}.`);
  }
}
export const onRequestError: Instrumentation.onRequestError = (error, _request, context) => {
  console.error(JSON.stringify({ ...safeErrorEvent(error, context.routePath, context.routeType), occurred_at: new Date().toISOString() }));
};
