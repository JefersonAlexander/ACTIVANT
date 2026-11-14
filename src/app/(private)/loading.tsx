export default function Loading() {
  return <div role="status" aria-label="Cargando tu espacio" className="space-y-7">
    <span className="sr-only">Consultando información…</span>
    <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse"><div className="h-9 w-3/4 rounded bg-border" /><div className="h-5 w-1/2 rounded bg-border" /><div className="grid gap-5 md:grid-cols-2"><div className="h-52 rounded-xl bg-border" /><div className="h-52 rounded-xl bg-border" /></div><div className="h-80 rounded-xl bg-border" /></div>
  </div>;
}
