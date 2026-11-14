"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="contenido" tabIndex={-1} className="mx-auto max-w-xl px-5 py-20 text-center" role="alert">
    <h1 className="text-2xl font-semibold">No pudimos mostrar este contenido</h1>
    <p className="my-5 text-muted-foreground">Ocurrió un error inesperado. Intenta cargar el contenido nuevamente.</p>
    <Button onClick={reset}>Intentar de nuevo</Button>
  </main>;
}
