"use client";
import { useEffect, useRef, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, CircleCheck, ScanLine, Square } from "lucide-react";
import type QrScanner from "qr-scanner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Panel } from "@/modules/dashboard/components/dashboard-ui";
import { formatTime } from "@/modules/dashboard/dates";
import { registerQrAttendance } from "../actions";
import type { AttendanceResult } from "../contracts";
export function AttendanceScanner() {
 const video=useRef<HTMLVideoElement>(null); const scanner=useRef<QrScanner|null>(null);
 const generation=useRef(0); const busy=useRef(false);
 const [scanning,setScanning]=useState(false); const [pending,setPending]=useState(false);
 const [result,setResult]=useState<AttendanceResult>({status:"idle",message:""});
 const router=useRouter();
 function stop() {generation.current++;scanner.current?.destroy();scanner.current=null;setScanning(false);}
 useEffect(()=>{
  const generationState=generation;
  const hidden=()=>{if(document.visibilityState==="hidden"){generation.current++;scanner.current?.destroy();scanner.current=null;setScanning(false);}};
  document.addEventListener("visibilitychange",hidden);
  return ()=>{generationState.current++;scanner.current?.destroy();document.removeEventListener("visibilitychange",hidden);};
 },[]);
 async function submit(payload:string) {
  if(busy.current) return;
  busy.current=true;stop();setPending(true);setResult({status:"idle",message:"Validando tu reserva…"});
  try {const response=await registerQrAttendance(payload);setResult(response);router.refresh();}
  catch {setResult({status:"error",message:"No pudimos confirmar el ingreso. Revisa tu historial antes de intentar nuevamente."});}
  finally {busy.current=false;setPending(false);}
 }
 async function start() {
  stop();const epoch=generation.current;setResult({status:"idle",message:"Solicitando acceso a la cámara…"});
  try {
   if(!navigator.mediaDevices?.getUserMedia) throw new Error("camera");
   const {default:QrReader}=await import("qr-scanner");
   if(epoch!==generation.current || !video.current) return;
   const reader=new QrReader(video.current,({data})=>startTransition(()=>{void submit(data);}),{preferredCamera:"environment",maxScansPerSecond:5,onDecodeError:()=>{},returnDetailedScanResult:true});
   scanner.current=reader;setScanning(true);await reader.start();
   if(epoch!==generation.current) {reader.destroy();return;}
   setResult({status:"idle",message:"Apunta la cámara al QR de la pantalla del gimnasio."});
  } catch {stop();setResult({status:"error",message:"No pudimos abrir la cámara. Revisa el permiso y usa una conexión HTTPS, o solicita el ingreso manual al personal."});}
 }
 async function readPhoto(file?:File) {
  if(!file || busy.current) return;stop();setPending(true);
  try {
   if(file.size>8*1024*1024 || !file.type.startsWith("image/")) throw new Error("image");
   const {default:QrReader}=await import("qr-scanner");
   const decoded=await QrReader.scanImage(file,{returnDetailedScanResult:true});
   await submit(decoded.data);
  } catch {setResult({status:"error",message:"No encontramos un QR legible en la imagen. Acércate a la pantalla e intenta con el código actual."});}
  finally {setPending(false);}
 }
 return <Panel title="Escanea el QR del gimnasio" description="Registra tu ingreso durante el horario de tu reserva.">
 <div className="relative mx-auto aspect-[4/3] max-w-xl overflow-hidden rounded-xl bg-secondary">
 <video ref={video} muted playsInline aria-label="Vista previa de la cámara" className="size-full object-cover"/>
 {!scanning && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"><ScanLine className="size-12 text-primary" aria-hidden="true"/><p className="max-w-xs text-sm leading-relaxed text-muted-foreground">Activa la cámara y apunta al código que muestra el personal.</p></div>}
 </div>
 <div className="mt-5 flex flex-wrap gap-3"><Button disabled={pending} onClick={()=>startTransition(()=>{void (scanning ? Promise.resolve(stop()) : start());})}>{scanning ? <Square aria-hidden="true"/> : <Camera aria-hidden="true"/>}{scanning ? "Detener cámara" : "Activar cámara"}</Button>{pending && <p role="status" className="self-center text-sm text-muted-foreground">Validando asistencia…</p>}</div>
 {result.message && <div role={result.status==="error" ? "alert" : "status"} className={`mt-5 rounded-xl border p-4 text-sm leading-relaxed ${result.status==="error" ? "border-destructive/30 text-destructive" : "bg-secondary text-foreground"}`}>{result.status==="success" && <CircleCheck aria-hidden="true" className="mb-2 size-6 text-primary"/>}<p>{result.message}</p>{result.checkedInAt && <p className="mt-2 font-medium">Hora de ingreso: {formatTime(result.checkedInAt)} · Colombia</p>}</div>}
 <details className="mt-6 border-t pt-5"><summary className="min-h-11 cursor-pointer text-sm font-medium">Usar una foto del código actual</summary><p className="my-3 text-sm leading-relaxed text-muted-foreground">Si tu navegador no abre el escáner, toma una foto del QR vigente. La imagen se procesa en tu dispositivo y el código debe seguir vigente al validarse.</p><Label htmlFor="qr-photo">Foto del QR (máximo 8 MB)</Label><input id="qr-photo" type="file" accept="image/*" capture="environment" disabled={pending || scanning} className="mt-2 block min-h-11 w-full min-w-0 rounded-lg border bg-white p-2 text-sm" onChange={event=>{const file=event.target.files?.[0];event.target.value="";startTransition(()=>{void readPhoto(file);});}}/></details>
 </Panel>;
}
