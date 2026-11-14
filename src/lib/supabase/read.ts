import "server-only";
export type ReadResult<T> = { data: T | null; error: string | null; count: number | null };
export async function read<T>(query: PromiseLike<{ data: T; error: unknown; count?: number | null }>): Promise<ReadResult<NonNullable<T>>> {
  try {
    const result = await query;
    if (result.error) return { data: null, count: null, error: "No pudimos consultar esta información. Intenta actualizar la página." };
    return { data: result.data ?? null, count: result.count ?? null, error: null };
  } catch {
    return { data: null, count: null, error: "La consulta no está disponible. Intenta actualizar la página." };
  }
}
