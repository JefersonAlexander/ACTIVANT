import { callbackSchema } from "./schemas.ts";

// No se acepta next/redirect_to/host de la URL como destino. Cada flujo tiene
// un único destino interno. Los enlaces de registro público no se admiten.
export function parseAuthCallback(params: URLSearchParams) {
  if (params.has("error") || params.has("error_code")) return null;
  if (params.getAll("code").length > 1 || params.getAll("token_hash").length > 1 || params.getAll("type").length > 1 || params.getAll("sb_flow_id").length > 1) return null;
  const code = params.get("code");
  const token_hash = params.get("token_hash");
  if (code && token_hash) return null;
  const input = code ? { code, ...(params.has("sb_flow_id") ? { sb_flow_id: params.get("sb_flow_id") } : {}) } : { token_hash, type: params.get("type") };
  const result = callbackSchema.safeParse(input);
  return result.success ? result.data : null;
}
