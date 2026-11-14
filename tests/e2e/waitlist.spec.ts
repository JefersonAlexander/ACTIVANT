import { test, expect, type Page, type TestInfo, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.setTimeout(90_000);
async function login(page: Page, kind: string, project: string) {
 await page.goto("/login"); await page.getByLabel("Correo electrónico",{exact:true}).fill(`${kind}-${project}@activant.test`);await page.getByLabel("Contraseña",{exact:true}).fill("test-only-passphrase-2026");await page.getByRole("button",{name:"Iniciar sesión",exact:true}).click();await expect(page.getByRole("heading",{name:"Tu espacio de bienestar",exact:true})).toBeVisible();
}
async function audit(page: Page,info: TestInfo,name:string) {
 const original=page.viewportSize();for(const width of [320,768,1024]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();if(width===320){await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath(`${name}-320.png`),fullPage:true});}}
 if(original)await page.setViewportSize(original);await page.evaluate(()=>window.scrollTo(0,0));expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations).toEqual([]);await page.screenshot({path:info.outputPath(`${name}.png`),fullPage:true});
}
async function join(page: Page,request:APIRequestContext) {
 const slot=await (await request.get("http://127.0.0.1:54322/_test/waitlist-info")).json() as {id:string;starts_at:string};
 const date=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota"}).format(new Date(slot.starts_at));await page.goto(`/gimnasio?mes=${date.slice(0,7)}`);
 const label=new Intl.DateTimeFormat("es-CO",{timeZone:"America/Bogota",weekday:"long",day:"numeric",month:"long"}).format(new Date(slot.starts_at));await page.getByRole("group",{name:"Selecciona un día del calendario"}).getByRole("button",{name:`${label}, con franjas publicadas`,exact:true}).click();
 await page.locator(`[data-slot-id="${slot.id}"]`).getByRole("button",{name:"Unirse a la lista de espera",exact:true}).click();await expect(page.getByRole("region",{name:"Tu lista de espera"})).toContainText("Posición 1");
}
async function event(request:APIRequestContext,kind:string,project:string,name:string){expect((await (await request.post("http://127.0.0.1:54322/_test/waitlist-event",{data:{kind:`${kind}-${project}`,event:name}})).json()).updated).toBeTruthy();}
// Protocolo Phoenix local para probar el SDK y el refresh. No sustituye RLS SQL.
async function realtime(page:Page) {
 let push:()=>void=()=>{throw new Error("Realtime todavía no se suscribió");};let joined=0;
 await page.routeWebSocket(/\/realtime\/v1\/websocket/,ws=>{
  ws.onMessage(raw=>{
   if(typeof raw!=="string")return;const [joinRef,ref,topic,name,payload]=JSON.parse(raw) as [string|null,string,string,string,{config?:{postgres_changes?:Record<string,unknown>[]}}];
   if(name==="phx_join"){
    const bindings=(payload.config?.postgres_changes??[]).map((filter,i)=>({...filter,id:i+1}));
    ws.send(JSON.stringify([joinRef,ref,topic,"phx_reply",{status:"ok",response:{postgres_changes:bindings}}]));joined+=1;
    push=()=>ws.send(JSON.stringify([joinRef,null,topic,"postgres_changes",{ids:[1],data:{schema:"public",table:"gym_availability_signals",type:"UPDATE",commit_timestamp:new Date().toISOString(),columns:[],record:{slot_id:"99000000-0000-4000-8000-000000000001",revision:2},old_record:{},errors:[]}}]));
   }else if(name==="heartbeat"||name==="phx_leave")ws.send(JSON.stringify([joinRef,ref,topic,"phx_reply",{status:"ok",response:{}}]));
  });
 });
 return {send:()=>push(),ready:()=>joined};
}
test("lista de espera, oferta por Realtime, aceptación y notificaciones de reserva",async({page,request},info)=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));const socket=await realtime(page);await login(page,"waitlist",info.project.name);await expect.poll(socket.ready).toBeGreaterThan(0);await join(page,request);const previous=socket.ready();await page.goto("/notificaciones");await expect.poll(socket.ready).toBeGreaterThan(previous);await expect(page.getByRole("region",{name:"Tu lista de espera"})).toContainText("En espera");
 await event(request,"waitlist",info.project.name,"offer");socket.send();const panel=page.getByRole("region",{name:"Tu lista de espera"});await expect(panel.getByText("Tienes un cupo",{exact:true})).toBeVisible();await expect(page.getByRole("link",{name:"Notificaciones: 1 sin leer",exact:true})).toBeVisible();
 await audit(page,info,"oferta-cupo");await panel.getByRole("button",{name:"Aceptar cupo",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Confirma tu cupo",exact:true});await expect(dialog).toBeVisible();expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);await dialog.getByRole("button",{name:"Confirmar reserva",exact:true}).click();await expect(page.getByRole("dialog")).not.toBeVisible();await expect(panel).toContainText("Sin solicitudes en espera");
 const inbox=page.getByRole("region",{name:"Tus notificaciones"});await expect(inbox.getByRole("heading",{name:"Reserva confirmada",exact:true})).toBeVisible();await inbox.getByRole("button",{name:"Marcar como leída",exact:true}).first().click();await expect(inbox.getByRole("status")).toContainText("marcada como leída");
 await page.goto("/historial");await expect(page.getByRole("region",{name:"Reservas activas"})).toContainText("Confirmada");await page.getByRole("region",{name:"Reservas activas"}).getByRole("button",{name:"Cancelar reserva",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"Confirmar cancelación",exact:true}).click();await expect(page.getByRole("dialog")).not.toBeVisible();await page.goto("/notificaciones");await expect(inbox.getByRole("heading",{name:"Reserva cancelada",exact:true})).toBeVisible();await audit(page,info,"notificaciones-reserva");expect(errors).toEqual([]);
});
test("rechazar oferta y retirar solicitud actualizan el historial",async({page,request},info)=>{
 await login(page,"waitlist-decline",info.project.name);await join(page,request);await event(request,"waitlist-decline",info.project.name,"offer");await page.goto("/notificaciones");const panel=page.getByRole("region",{name:"Tu lista de espera"});await panel.getByRole("button",{name:"Rechazar cupo",exact:true}).click();await expect(panel).toContainText("Sin solicitudes en espera");await panel.getByText("Historial de solicitudes y ofertas",{exact:true}).click();await expect(panel).toContainText("Oferta rechazada");await join(page,request);await page.getByRole("region",{name:"Tu lista de espera"}).getByRole("button",{name:"Salir de la lista",exact:true}).click();await expect(page.getByRole("region",{name:"Tu lista de espera"})).toContainText("Sin solicitudes en espera");
});
test("oferta vencida en servidor muestra error y no confirma reserva",async({page,request},info)=>{
 await login(page,"waitlist-expire",info.project.name);await join(page,request);await event(request,"waitlist-expire",info.project.name,"offer");await page.goto("/notificaciones");await page.getByRole("button",{name:"Aceptar cupo",exact:true}).click();await event(request,"waitlist-expire",info.project.name,"expire-on-accept");await page.getByRole("dialog").getByRole("button",{name:"Confirmar reserva",exact:true}).click();await expect(page.getByRole("dialog")).not.toBeVisible();await expect(page.getByRole("main")).toContainText("Tu oferta de cupo venció");await page.goto("/historial");await expect(page.getByText("Aún no tienes reservas activas",{exact:true})).toBeVisible();
});
test("estados vacío y error; cuenta sin sesión y configuración administrativa protegidas",async({page},info)=>{
 await page.goto("/notificaciones");await expect(page).toHaveURL(/\/login/);await login(page,"waitlist-empty",info.project.name);await page.goto("/notificaciones");await expect(page.getByText("Todavía no tienes notificaciones",{exact:true})).toBeVisible();await audit(page,info,"notificaciones-vacias");await page.goto("/admin/horarios");await expect(page).toHaveURL(/\/dashboard\?estado=sin-permiso$/);
 await login(page,"waitlist-error",info.project.name);await page.goto("/notificaciones");await expect(page.getByRole("region",{name:"Tus notificaciones"}).getByRole("alert")).toContainText("No pudimos consultar");await expect(page.getByText("Todavía no tienes notificaciones",{exact:true})).toHaveCount(0);
 await login(page,"waitlist-admin",info.project.name);await page.goto("/admin/horarios");const rules=page.getByRole("region",{name:"Lista de espera y notificaciones"});await rules.getByLabel("Tiempo para aceptar el cupo (minutos)").fill("3");await rules.getByLabel("Recordatorios dentro de ACTIVANT").selectOption("enabled");await rules.getByLabel("Anticipación del recordatorio (minutos)").fill("90");await rules.getByRole("button",{name:"Guardar notificaciones",exact:true}).click();await expect(rules.getByRole("status")).toContainText("Configuración guardada");await page.reload();await expect(rules.getByLabel("Tiempo para aceptar el cupo (minutos)")).toHaveValue("3");await audit(page,info,"configuracion-avisos");
});
