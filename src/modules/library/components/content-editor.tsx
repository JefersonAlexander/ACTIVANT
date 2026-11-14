"use client";
import { useActionState, useId, useState, useTransition } from "react";
import { ImagePlus, Upload, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { finalizeAsset, prepareAsset, saveContent } from "../actions";
import { initialActionState, libraryCategories } from "../contracts";
import type { LibraryAsset, LibraryContent } from "../services/queries";
const selectClass = "min-h-12 w-full min-w-0 rounded-lg border bg-white px-3 text-sm";
function AssetUpload({ kind, onReady, onBusy }: { kind: "cover" | "video"; onReady: (id:string)=>void; onBusy:(value:boolean)=>void }) {
  const [file,setFile] = useState<File|null>(null); const [message,setMessage] = useState(""); const [error,setError] = useState(false); const [pending,start] = useTransition(); const id = useId();
  function upload() { if (!file) return; start(async()=>{
    onBusy(true); setMessage(""); setError(false);
    try {
      const prepared = await prepareAsset({ kind, mimeType:file.type, sizeBytes:file.size });
      if (prepared.error || !prepared.objectPath || !prepared.id) { setError(true); setMessage(prepared.error ?? "No pudimos preparar el archivo."); return; }
      const result = await createClient().storage.from("activant-wellness").upload(prepared.objectPath,file,{ contentType:file.type,upsert:false,cacheControl:"0" });
      if (result.error) { setError(true); setMessage("No pudimos cargar el archivo. Verifica la conexión, los límites de Storage y tu permiso administrativo."); return; }
      const finalized = await finalizeAsset(prepared.id);
      if (finalized.error) { setError(true); setMessage(finalized.error); return; }
      onReady(prepared.id); setMessage("Archivo cargado y seleccionado. Guarda el contenido para vincularlo.");
    } catch { setError(true); setMessage("La carga no pudo confirmarse. Revisa la conexión antes de intentar nuevamente."); }
    finally { onBusy(false); }
  }); }
  return <div className="space-y-3 rounded-xl bg-muted p-4" aria-busy={pending}><Label htmlFor={id}>{kind === "cover" ? "Nueva portada" : "Nuevo video"}</Label><Input id={id} type="file" accept={kind === "cover" ? "image/jpeg,image/png,image/webp" : "video/mp4,video/webm"} onChange={e=>{setFile(e.target.files?.[0]??null);setMessage("");}}/><p className="text-xs leading-relaxed text-muted-foreground">{kind === "cover" ? "JPG, PNG o WebP. Máximo 5 MB." : "MP4 o WebM. Máximo 100 MB y el límite de tu proyecto Storage. Verifica subtítulos y accesibilidad antes de publicar."}</p><Button type="button" variant="outline" disabled={!file||pending} onClick={upload}><Upload aria-hidden="true"/>{pending ? "Cargando…" : kind === "cover" ? "Cargar portada" : "Cargar video"}</Button>{message && <p role={error?"alert":"status"} className={`text-sm leading-relaxed ${error?"text-destructive":"text-primary"}`}>{message}</p>}</div>;
}
export function ContentEditor({ assets, content }: { assets: LibraryAsset[]; content?: LibraryContent }) {
  const [state,action,pending] = useActionState(saveContent,initialActionState); const id = useId();
  // Un refresh de disponibilidad no debe actualizar la revisión de un borrador abierto.
  // Solo una respuesta a nuestro guardado avanza la versión de esta edición.
  const [initialRevision] = useState(content?.revision ?? 0);
  const [cover,setCover] = useState(content?.cover_asset_id ?? ""),[video,setVideo] = useState(content?.video_asset_id ?? "");
  const [source,setSource] = useState(content?.video_asset_id ? "video" : "link"); const [uploadBusy,setUploadBusy] = useState(false);
  function assetSelect(kind:"cover"|"video",value:string,setValue:(s:string)=>void) {
    const options=assets.filter(a=>a.kind===kind);
    return <div className="space-y-2"><Label htmlFor={`${id}-${kind}`}>{kind==="cover"?"Portada seleccionada":"Video seleccionado"}</Label><select id={`${id}-${kind}`} name={kind==="cover"?"coverAssetId":"videoAssetId"} value={value} onChange={e=>setValue(e.target.value)} className={selectClass}><option value="">Selecciona un archivo cargado</option>{options.map((a,n)=><option key={a.id} value={a.id}>{kind==="cover"?"Portada":"Video"} {n+1} · {a.id.slice(0,8)} · {a.mime_type}</option>)}{value&&!options.some(a=>a.id===value)&&<option value={value}>Archivo seleccionado · {value.slice(0,8)}</option>}</select></div>;
  }
  return <form action={action} aria-busy={pending||uploadBusy} className="space-y-4"><input type="hidden" name="id" value={content?.id??""}/><input type="hidden" name="revision" value={state.revision ?? initialRevision}/><fieldset disabled={pending||uploadBusy} className="min-w-0 space-y-4">
    <div className="space-y-2"><Label htmlFor={`${id}-title`}>Título</Label><Input id={`${id}-title`} name="title" minLength={3} maxLength={160} defaultValue={content?.title} required/></div>
    <div className="space-y-2"><Label htmlFor={`${id}-description`}>Descripción</Label><textarea id={`${id}-description`} name="description" minLength={10} maxLength={4000} rows={4} defaultValue={content?.description} required className="w-full min-w-0 rounded-lg border bg-white p-3 text-sm"/></div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor={`${id}-category`}>Categoría</Label><select id={`${id}-category`} name="category" defaultValue={content?.category??"rutinas"} className={selectClass}>{Object.entries(libraryCategories).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></div><div className="space-y-2"><Label htmlFor={`${id}-duration`}>Duración (minutos)</Label><Input id={`${id}-duration`} name="durationMinutes" type="number" min={1} max={600} defaultValue={content?.duration_minutes??10} required/></div></div>
    <div className="space-y-3 border-t pt-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><ImagePlus aria-hidden="true" className="size-4"/>Portada privada</h3>{assetSelect("cover",cover,setCover)}<AssetUpload kind="cover" onReady={setCover} onBusy={setUploadBusy}/></div>
    <div className="space-y-3 border-t pt-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><Video aria-hidden="true" className="size-4"/>Recurso de bienestar</h3><div className="space-y-2"><Label htmlFor={`${id}-source`}>Tipo de recurso</Label><select id={`${id}-source`} value={source} onChange={e=>setSource(e.target.value)} className={selectClass}><option value="link">Enlace HTTPS autorizado</option><option value="video">Video privado en Storage</option></select></div>
      {source==="video" ? <>{assetSelect("video",video,setVideo)}<AssetUpload kind="video" onReady={setVideo} onBusy={setUploadBusy}/><input type="hidden" name="externalUrl" value=""/></> : <><input type="hidden" name="videoAssetId" value=""/><div className="space-y-2"><Label htmlFor={`${id}-url`}>Enlace autorizado</Label><Input id={`${id}-url`} name="externalUrl" type="url" maxLength={2048} defaultValue={content?.external_url??""} placeholder="https://"/><p className="text-xs leading-relaxed text-muted-foreground">Verifica el destino, los permisos de acceso y la autorización para compartir el recurso con las cuentas institucionales.</p></div></>}
    </div><div className="space-y-2"><Label htmlFor={`${id}-status`}>Estado de publicación</Label><select id={`${id}-status`} name="status" defaultValue={content?.status??"draft"} className={selectClass}><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></select></div>
    <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed"><input name="authorized" type="checkbox" value="yes" className="mt-1 size-4 shrink-0 accent-primary"/>Confirmo que la portada y el video o enlace cuentan con autorización institucional y permisos de uso. Obligatorio para publicar.</label><Button type="submit" disabled={pending||uploadBusy}>{pending?"Guardando…":content?"Guardar cambios":"Guardar contenido"}</Button>
  </fieldset>{state.message&&<p role={state.status==="error"?"alert":"status"} className={`rounded-lg border p-3 text-sm leading-relaxed ${state.status==="error"?"text-destructive":"bg-secondary text-primary"}`}>{state.message}</p>}</form>;
}
