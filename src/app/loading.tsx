export default function Loading() {
  return <div role="status" aria-label="Cargando contenido" className="mx-auto max-w-7xl space-y-6 px-5 py-20 sm:px-8">
    <span className="sr-only">Cargando contenido…</span>
    <div aria-hidden="true" className="space-y-5 motion-safe:animate-pulse">
      <div className="h-5 w-40 rounded bg-muted" />
      <div className="h-12 w-3/4 max-w-xl rounded bg-muted" />
      <div className="h-6 w-full max-w-md rounded bg-muted" />
      <div className="h-64 w-full rounded-xl bg-muted" />
    </div>
  </div>;
}
