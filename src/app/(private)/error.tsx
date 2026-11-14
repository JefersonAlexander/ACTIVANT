"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div role="alert" className="rounded-xl border bg-white p-8"><h1 className="text-2xl font-semibold">No pudimos cargar tu espacio</h1><p className="my-4 text-muted-foreground">No fue posible verificar el acceso o consultar la información. Intenta nuevamente.</p><Button onClick={reset}>Intentar de nuevo</Button></div>;
}
