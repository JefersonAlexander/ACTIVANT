import { test, expect, type Page, type TestInfo, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import QRCode from "qrcode";
test.setTimeout(90_000);
async function login(page:Page,kind:string,project:string){
 await page.goto("/login");await page.getByLabel("Correo electrónico",{exact:true}).fill(`${kind}-${project}@activant.test`);await page.getByLabel("Contraseña",{exact:true}).fill("test-only-passphrase-2026");await page.getByRole("button",{name:"Iniciar sesión",exact:true}).click();await expect(page.getByRole("heading",{name:"Tu espacio de bienestar",exact:true})).toBeVisible();
}
async function payloads(request:APIRequestContext){return await (await request.get("http://127.0.0.1:54322/_test/attendance-info")).json() as Record<string,string>;}
async function resetAttendance(request:APIRequestContext,kind:string,project:string){
 const response=await request.post("http://127.0.0.1:54322/_test/attendance-reset",{data:{kind:`${kind}-${project}`}});
 expect(response.ok()).toBeTruthy();
}
async function upload(page:Page,payload:string){
 const file=await QRCode.toBuffer(payload,{width:480,margin:4});
 const details=page.locator("details").filter({has:page.getByText("Usar una foto del código actual",{exact:true})});
 if(!await details.evaluate(node=>(node as HTMLDetailsElement).open))await details.locator("summary").click();
 await page.getByLabel("Foto del QR (máximo 8 MB)").setInputFiles({name:"qr-fixture.png",mimeType:"image/png",buffer:file});
}
async function audit(page:Page,info:TestInfo,name:string){
 // Las acciones pueden actualizar el contenido antes que los metadatos de Next.
 await expect(page).toHaveTitle(/ACTIVANT/);
 await page.evaluate(()=>window.scrollTo(0,0));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 const report=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();expect(report.violations).toEqual([]);
 await page.screenshot({path:info.outputPath(name),fullPage:true});
}
test("personal muestra QR y lo renueva automáticamente a los 15 segundos",async({page},info)=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await login(page,"attendance-staff",info.project.name);await page.goto("/control-asistencia/qr");
 const image=page.getByRole("img",{name:"Código QR de acceso al gimnasio"});await expect(image).toBeVisible();
 const original=await image.getAttribute("src");expect(original).toMatch(/^data:image\/png;base64,/);
 await audit(page,info,"qr-gimnasio.png");
 await expect(image).not.toHaveAttribute("src",original!,{timeout:22_000});await expect(image).toBeVisible();
 expect(errors).toEqual([]);
});
test("cámara denegada permite foto válida y confirma asistencia e historial",async({page,request},info)=>{
 await resetAttendance(request,"attendance",info.project.name);
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await login(page,"attendance",info.project.name);await page.goto("/asistencia");
 await expect(page.getByRole("heading",{name:"Registrar asistencia",exact:true})).toBeVisible();await expect(page.getByText("Sin asistencias registradas",{exact:true})).toBeVisible();
 await audit(page,info,"escaner-listo.png");
 await page.evaluate(()=>{Object.defineProperty(navigator.mediaDevices,"getUserMedia",{configurable:true,value:async()=>{throw new DOMException("Fixture permission denied","NotAllowedError");}});});
 await page.getByRole("button",{name:"Activar cámara",exact:true}).click();await expect(page.getByRole("region",{name:"Escanea el QR del gimnasio"}).getByRole("alert")).toContainText("No pudimos abrir la cámara");
 const values=await payloads(request);await upload(page,values.ok!);
 await expect(page.getByRole("status").filter({hasText:"Asistencia registrada."})).toBeVisible();
 await expect(page.getByRole("region",{name:"Historial de asistencias"})).toContainText("Código QR");
 await audit(page,info,"asistencia-confirmada.png");await page.reload();await expect(page.getByRole("region",{name:"Historial de asistencias"})).toContainText("Código QR");expect(errors).toEqual([]);
});
test("QR vencido, manipulado, sin reserva, cancelado y duplicado muestran mensajes seguros",async({page,request},info)=>{
 await login(page,"attendance-errors",info.project.name);await page.goto("/asistencia");
 for(const [key,message] of [["expired_qr","El QR expiró"],["tampered","Este código no es válido"],["no_reservation","No tienes una reserva"],["reservation_cancelled","La reserva está cancelada"],["already_recorded","ya está registrada"],["rate_limited","demasiados intentos"]]){
  const values=await payloads(request);await upload(page,key==="tampered" ? `ACTIVANT:GYM:1:${"0".repeat(64)}` : values[key!]!);await expect(page.getByRole("region",{name:"Escanea el QR del gimnasio"}).getByRole("alert")).toContainText(message!);
 }
 await audit(page,info,"asistencia-error.png");
});
test("personal registra ingreso manual con motivo y evita duplicados",async({page,request},info)=>{
 await resetAttendance(request,"attendance-staff",info.project.name);
 await login(page,"attendance-staff",info.project.name);await page.goto("/control-asistencia");
 const reservations=page.getByRole("region",{name:"Reservas de la franja en curso"});const id=(await reservations.locator("p.font-mono").textContent())!;
 const form=page.getByRole("region",{name:"Ingreso manual excepcional"});await form.getByLabel("Código de reserva",{exact:true}).fill(id);await form.getByLabel("Motivo de excepción").selectOption("camera_unavailable");await form.getByRole("button",{name:"Confirmar ingreso manual",exact:true}).click();await expect(form.getByRole("status")).toContainText("registrada y auditada");
 await expect(page.getByRole("region",{name:"Asistencias de hoy"})).toContainText("Ingreso manual");await audit(page,info,"panel-asistencia.png");
 await form.getByLabel("Código de reserva",{exact:true}).fill(id);await form.getByLabel("Motivo de excepción").selectOption("camera_unavailable");await form.getByRole("button",{name:"Confirmar ingreso manual",exact:true}).click();await expect(form.getByRole("alert")).toContainText("ya está registrada");
});
test("rutas de asistencia exigen sesión y el QR del personal exige rol",async({page},info)=>{
 for(const path of ["/asistencia","/control-asistencia","/control-asistencia/qr"]){await page.goto(path);await expect(page).toHaveURL(/\/login/);}
 await login(page,"attendance-errors",info.project.name);
 for(const path of ["/control-asistencia","/control-asistencia/qr"]){await page.goto(path);await expect(page).toHaveURL(/\/dashboard\?estado=sin-permiso$/);}
 await page.goto("/asistencia");await expect(page.getByRole("heading",{name:"Registrar asistencia",exact:true})).toBeVisible();
});

test("cámara decodifica un QR real desde un flujo de video y detiene sus pistas",async({page,request},info)=>{
 await resetAttendance(request,"attendance-camera",info.project.name);
 await login(page,"attendance-camera",info.project.name);await page.goto("/asistencia");
 const values=await payloads(request);const image=await QRCode.toDataURL(values.ok!,{width:280,margin:4});
 await page.evaluate(async(src)=>{
  const frame=new Image();frame.src=src;await frame.decode();
  Object.defineProperty(navigator.mediaDevices,"getUserMedia",{configurable:true,value:async()=>{
   const canvas=document.createElement("canvas");canvas.width=640;canvas.height=640;
   const draw=()=>{const context=canvas.getContext("2d")!;context.fillStyle="white";context.fillRect(0,0,640,640);context.drawImage(frame,180,180,280,280);};draw();
   const stream=canvas.captureStream(12);const timer=setInterval(draw,80);
   const track=stream.getVideoTracks()[0]!;const original=track.stop.bind(track);track.stop=()=>{clearInterval(timer);original();};
   Object.assign(window,{attendanceFixtureTrack:track});return stream;
  }});
 },image);
 await page.getByRole("button",{name:"Activar cámara",exact:true}).click();
 await expect(page.getByRole("status").filter({hasText:"Asistencia registrada."})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {attendanceFixtureTrack:MediaStreamTrack}).attendanceFixtureTrack.readyState)).toBe("ended");
 await expect(page.getByRole("region",{name:"Historial de asistencias"})).toContainText("Código QR");
});
