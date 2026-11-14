"use client";
export default function GlobalError({ reset }: { error: Error & { digest?:string }; reset:()=>void }) {
  return <html lang="es-CO"><body style={{margin:0,background:"#eff9f4"}}><main role="alert" style={{maxWidth:560,margin:"64px auto",padding:24,fontFamily:"system-ui",lineHeight:1.6,color:"#0b5743"}}><h1>No pudimos cargar ACTIVANT</h1><p>Ocurrió un error inesperado. Intenta nuevamente en unos minutos.</p><button onClick={reset} style={{minHeight:48,padding:"12px 20px",background:"#2cf5a0",color:"#064c39",border:0,borderRadius:999,cursor:"pointer"}}>Intentar de nuevo</button></main></body></html>;
}
