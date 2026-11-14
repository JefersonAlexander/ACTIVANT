"use client";
export default function GlobalError({ reset }: { error: Error & { digest?:string }; reset:()=>void }) {
  return <html lang="es-CO"><body><main role="alert" style={{maxWidth:560,margin:"64px auto",padding:24,fontFamily:"system-ui",lineHeight:1.6,color:"#24382f"}}><h1>No pudimos cargar ACTIVANT</h1><p>Ocurrió un error inesperado. Intenta nuevamente en unos minutos.</p><button onClick={reset} style={{minHeight:48,padding:"12px 20px",background:"#246747",color:"white",border:0,borderRadius:8,cursor:"pointer"}}>Intentar de nuevo</button></main></body></html>;
}
