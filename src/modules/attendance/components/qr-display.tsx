"use client";
import Image from "next/image";
import { useEffect, useState, startTransition } from "react";
import { QrCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/modules/dashboard/components/dashboard-ui";
import { formatTime } from "@/modules/dashboard/dates";
import { issueDisplayQr } from "../actions";
import type { DisplayQrResult } from "../contracts";
export function QrDisplay() {
 const [result,setResult]=useState<DisplayQrResult|null>(null);
 const [seconds,setSeconds]=useState(0);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  let cancelled=false; let renew: ReturnType<typeof setTimeout>; let ticker: ReturnType<typeof setInterval>; let deadline=0; let inFlight=false;
  async function load() {
   if(inFlight) return; inFlight=true;
   clearInterval(ticker); setResult(null); setSeconds(0);
   const started=performance.now();
   try {
    const data=await issueDisplayQr();
    if(cancelled) return;
    if(data.status==="ok") {
     const remaining=Math.max(0,Date.parse(data.expiresAt)-Date.parse(data.serverNow)-(performance.now()-started));
     if(remaining>0) {
      deadline=performance.now()+remaining; setSeconds(Math.ceil(remaining/1000)); setResult(data);
      ticker=setInterval(()=>setSeconds(Math.max(0,Math.ceil((deadline-performance.now())/1000))),250);
      renew=setTimeout(()=>startTransition(()=>{void load();}),remaining);
     } else renew=setTimeout(()=>startTransition(()=>{void load();}),1000);
    } else { setResult(data); renew=setTimeout(()=>startTransition(()=>{void load();}),15_000); }
   } catch {
    if(!cancelled) { setResult({status:"error",message:"No pudimos renovar el QR. Comprueba la conexión y vuelve a intentar."}); renew=setTimeout(()=>startTransition(()=>{void load();}),15_000); }
   } finally { inFlight=false; }
  }
  startTransition(()=>{void load();});
  // Al volver a la pestaña se oculta inmediatamente cualquier imagen vencida.
  const visible=()=>{if(document.visibilityState==="visible" && performance.now()>=deadline) {clearTimeout(renew);startTransition(()=>{void load();});}};
  document.addEventListener("visibilitychange",visible);
  return ()=>{cancelled=true;clearTimeout(renew);clearInterval(ticker);document.removeEventListener("visibilitychange",visible);};
 },[retry]);
 return <Panel title="Escanea para ingresar" description="Abre Registrar asistencia en ACTIVANT desde tu celular.">
 <div className="mx-auto flex max-w-lg flex-col items-center text-center">
 <div className="flex aspect-square w-full max-w-[360px] items-center justify-center rounded-2xl border bg-white p-3 sm:p-4">
 {result?.status==="ok" && seconds>0 ? <Image unoptimized src={result.image} width={480} height={480} alt="Código QR de acceso al gimnasio" className="size-full object-contain"/> : <div role="status" className="space-y-3 px-5"><QrCode className="mx-auto size-12 text-primary" aria-hidden="true"/><p className="text-sm leading-relaxed">{result?.status==="error" ? result.message : "Preparando un código seguro…"}</p></div>}
 </div>
 {result?.status==="ok" && <><p className="mt-5 text-lg font-semibold">Franja {formatTime(result.startsAt)} – {formatTime(result.endsAt)}</p><p className="mt-2 text-sm text-muted-foreground" aria-hidden="true">Nuevo código en {seconds} s</p><p className="sr-only">El código se renueva automáticamente cada 15 segundos.</p></>}
 <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">Cada persona debe ingresar con su propia cuenta y tener una reserva vigente.</p>
 {result?.status==="error" && <Button variant="outline" className="mt-5" onClick={()=>setRetry(v=>v+1)}><RefreshCw aria-hidden="true"/>Volver a intentar</Button>}
 </div></Panel>;
}
