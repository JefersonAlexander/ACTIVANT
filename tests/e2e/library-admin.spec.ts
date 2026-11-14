import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
test.setTimeout(90_000);
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64");
async function login(page:Page,kind:string,project:string){await page.goto("/login");await page.getByLabel("Correo electrónico",{exact:true}).fill(`${kind}-${project}@activant.test`);await page.getByLabel("Contraseña",{exact:true}).fill("test-only-passphrase-2026");await page.getByRole("button",{name:"Iniciar sesión",exact:true}).click();await expect(page).toHaveURL(/\/dashboard$/);await expect(page.getByRole("heading",{level:1})).toHaveText("Tu espacio de bienestar");}
async function checkLayout(page:Page,path:string){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);const axe=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();expect(axe.violations).toEqual([]);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path,fullPage:true});}
test("biblioteca: catálogo, categoría, detalle y descarga privada sin enlaces públicos",async({page},info)=>{
 await login(page,"library",info.project.name);await page.goto("/biblioteca");await expect(page.getByRole("heading",{name:"Biblioteca de bienestar"})).toBeVisible();await expect(page.getByRole("heading",{name:"Movilidad de prueba"})).toBeVisible();
 const asset=await page.request.get("/biblioteca/archivos/97000000-0000-4000-8000-000000000001",{headers:{Range:"bytes=0-9"}});expect(asset.status()).toBe(206);expect(asset.headers()["content-range"]).toMatch(/^bytes 0-9\//);expect(asset.headers()["cache-control"]).toContain("no-store");expect((await asset.body()).length).toBe(10);
 await checkLayout(page,info.outputPath("biblioteca.png"));
 await page.getByLabel("Categoría",{exact:true}).selectOption("casa");await page.getByRole("button",{name:"Filtrar contenidos"}).click();await expect(page.getByText("No hay contenidos publicados para esta búsqueda",{exact:true})).toBeVisible();
 await page.getByLabel("Categoría",{exact:true}).selectOption("movilidad");await page.getByRole("button",{name:"Filtrar contenidos"}).click();await page.getByRole("link",{name:/Ver actividad.*Movilidad de prueba/}).click();await expect(page.getByRole("heading",{level:1})).toHaveText("Movilidad de prueba");
 const link=page.getByRole("link",{name:/Abrir recurso autorizado/});await expect(link).toHaveAttribute("href","https://example.invalid/actividad");await expect(link).toHaveAttribute("rel",/noopener/);
 expect(await page.locator('a[href*="/object/public/"],a[href*="/object/sign/"]').count()).toBe(0);await checkLayout(page,info.outputPath("actividad.png"));
 if(info.project.name==="mobile"){await page.setViewportSize({width:320,height:812});await checkLayout(page,info.outputPath("actividad-320.png"));}
});
test("biblioteca distingue vacío, error, vinculación no autorizada y protege administración",async({page},info)=>{
 for(const [kind,text] of [["library-empty","No hay contenidos publicados para esta búsqueda"],["library-error","No pudimos consultar"],["library-denied","Tu vinculación necesita revisión"]]){
  await login(page,kind!,info.project.name);await page.goto("/biblioteca");if(kind==="library-error")await expect(page.getByRole("main").getByRole("alert")).toBeVisible();else await expect(page.getByText(text!,{exact:true})).toBeVisible();
  if(kind==="library-denied"){const r=await page.request.get("/biblioteca/archivos/97000000-0000-4000-8000-000000000001");expect(r.status()).toBe(404);}
  const denied=await page.request.get("/admin/exportar?tipo=franjas",{maxRedirects:0});expect(denied.status()).toBe(307);
  await page.goto("/admin/contenidos");await expect(page).toHaveURL(/dashboard\?estado=sin-permiso/);await page.context().clearCookies();
 }
});
test("administración publica con portada privada, autorización, vista previa y archivado",async({page},info)=>{
 await login(page,"management-publishing-admin",info.project.name);await page.goto("/admin/contenidos");
 const panel=page.getByRole("region",{name:"Nuevo contenido",exact:true});await panel.getByLabel("Título",{exact:true}).fill("Pausa autorizada de prueba");await panel.getByLabel("Descripción",{exact:true}).fill("Contenido sintético para comprobar publicación y archivo, sin datos reales.");await panel.getByLabel("Categoría",{exact:true}).selectOption("pausas");
 await panel.getByLabel("Nueva portada",{exact:true}).setInputFiles({name:"portada-prueba.png",mimeType:"image/png",buffer:png});await panel.getByRole("button",{name:"Cargar portada",exact:true}).click();await expect(panel.getByRole("status")).toContainText("Archivo cargado y seleccionado");
 await panel.getByLabel("Enlace autorizado",{exact:true}).fill("https://example.invalid/pausa");await panel.getByLabel("Estado de publicación").selectOption("published");await panel.getByLabel(/Confirmo que la portada/).check();await panel.getByRole("button",{name:"Guardar contenido",exact:true}).click();await expect(panel.getByRole("status").filter({hasText:/Contenido/})).toBeVisible();
 const created=page.locator("li[data-content-id]").filter({has:page.getByRole("heading",{name:"Pausa autorizada de prueba",exact:true})});await expect(created.locator('[data-slot="badge"]').filter({hasText:/^Publicado$/})).toBeVisible();
 const id=await created.getAttribute("data-content-id");const row=page.locator(`li[data-content-id="${id}"]`);await row.getByText("Editar contenido",{exact:true}).click();await row.getByLabel("Título",{exact:true}).fill("Mi edición sin guardar");
 const update=await page.request.post("http://127.0.0.1:54322/_test/library-revise",{data:{kind:`management-publishing-admin-${info.project.name}`,id}});expect((await update.json()).updated).toBe(true);await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await expect(row.getByRole("heading",{name:"Edición concurrente de prueba",exact:true})).toBeVisible();await expect(row.locator('input[name="revision"]')).toHaveValue("1");await row.getByLabel(/Confirmo que la portada/).check();await row.getByRole("button",{name:"Guardar cambios",exact:true}).click();await expect(row.getByRole("alert")).toContainText("Otra persona modificó");
 await page.reload();await row.getByText("Editar contenido",{exact:true}).click();await row.getByLabel("Estado de publicación").selectOption("archived");await row.getByRole("button",{name:"Guardar cambios",exact:true}).click();await expect(row.locator('[data-slot="badge"]').filter({hasText:/^Archivado$/})).toBeVisible();
 await page.goto("/biblioteca");await expect(page.getByRole("heading",{name:"Edición concurrente de prueba",exact:true})).toHaveCount(0);await page.goto("/admin/contenidos");await checkLayout(page,info.outputPath("contenidos.png"));
 expect(await page.content()).not.toContain("sb_secret_fixture_only_not_a_real_key");
});
test("administración gestiona cuenta, rol, habilitación e invitación sin editarse a sí misma",async({page},info)=>{
 await login(page,"management-users-admin",info.project.name);await page.goto("/admin/usuarios");await expect(page.getByText(/Esta es tu cuenta/)).toBeVisible();const row=page.locator('li[data-user-id="97000000-0000-4000-8000-000000000005"]');await row.getByText("Gestionar cuenta",{exact:true}).click();
 const access=row.getByRole("region",{name:"Estado y vinculación",exact:true});await access.getByLabel("Estado de la cuenta").selectOption("true");await access.getByLabel("Tipo de vinculación").selectOption("contratista");await access.getByRole("button",{name:"Guardar acceso"}).click();await expect(row.getByText("Cuenta activa",{exact:true})).toBeVisible();
 const roles=row.getByRole("region",{name:"Roles",exact:true});await roles.getByRole("button",{name:"Guardar permisos"}).click();await expect(row.getByText(/Roles: Usuario, Personal de gimnasio/)).toBeVisible();
 const gym=row.getByRole("region",{name:"Habilitación del gimnasio",exact:true});await gym.getByLabel("Acceso al gimnasio").selectOption("true");await gym.getByRole("button",{name:"Guardar habilitación"}).click();await expect(gym.getByRole("status")).toContainText("actualizada y auditada");
 const invite=page.getByRole("region",{name:"Invitar una cuenta",exact:true});await invite.getByLabel("Correo de la persona a invitar").fill(`invitada-${info.project.name}@fixture.invalid`);await invite.getByRole("button",{name:"Enviar invitación"}).click();await expect(invite.getByRole("status")).toContainText("perfil nace inactivo");
 await page.goto("/admin/usuarios");await checkLayout(page,info.outputPath("usuarios.png"));
 if(info.project.name==="mobile"){await page.setViewportSize({width:320,height:812});await checkLayout(page,info.outputPath("usuarios-320.png"));}
});
test("reportes filtran, exportan CSV seguro, auditan y permiten cancelar reservas",async({page},info)=>{
 await login(page,"management-reports-admin",info.project.name);await page.goto("/admin/reportes");await expect(page.getByRole("heading",{name:"Asistencias efectivas",exact:true})).toBeVisible();await expect(page.getByRole("region",{name:"Demanda por horario",exact:true})).toContainText("7 solicitudes");
 await page.getByLabel("Franja",{exact:true}).selectOption("97000000-0000-4000-8000-000000000003");await page.getByRole("button",{name:"Aplicar filtros"}).click();await expect(page).toHaveURL(/franja=97000000/);
 const [download]=await Promise.all([page.waitForEvent("download"),page.getByRole("link",{name:"Exportar franjas CSV"}).click()]);const csv=await readFile((await download.path())!,"utf8");expect(csv).toContain('"ocupacion_porcentaje"');expect(csv).toContain('"asistencias_efectivas"');expect(csv).not.toMatch(/@|diagnóstico|justification|reason/i);
 await checkLayout(page,info.outputPath("reportes.png"));if(info.project.name==="mobile"){await page.setViewportSize({width:320,height:812});await checkLayout(page,info.outputPath("reportes-320.png"));await page.setViewportSize({width:412,height:915});}
 await page.goto("/admin/auditoria");await expect(page.getByText("administrative_exports · UPDATE")).toBeVisible();await checkLayout(page,info.outputPath("auditoria.png"));
 const [auditDownload]=await Promise.all([page.waitForEvent("download"),page.getByRole("link",{name:"Exportar auditoría CSV"}).click()]);const audit=await readFile((await auditDownload.path())!,"utf8");expect(audit).not.toMatch(/old_values|new_values|@fixture/);
 await page.goto("/admin/reservas");await page.getByRole("button",{name:"Cancelar reserva",exact:true}).click();await page.getByRole("button",{name:"Confirmar cancelación",exact:true}).click();await expect(page.getByText("Cancelada",{exact:true})).toBeVisible();
 await page.goto("/admin/configuracion");await expect(page.getByRole("heading",{name:"Configuración de reglas",exact:true})).toBeVisible();await expect(page.getByRole("region",{name:"Reservas y capacidad predeterminada",exact:true})).toBeVisible();
});
test("gestión muestra errores de consulta y rechaza exportaciones inválidas",async({page},info)=>{
 await login(page,"management-error-admin",info.project.name);await page.goto("/admin/reportes");await expect(page.getByRole("main").getByRole("alert").first()).toBeVisible();await page.goto("/admin/contenidos");await expect(page.getByRole("main").getByRole("alert").first()).toBeVisible();
 const invalid=await page.request.get("/admin/exportar?tipo=franjas&desde=2026-01-01&hasta=2026-12-31");expect(invalid.status()).toBe(400);const unavailable=await page.request.get("/admin/exportar?tipo=franjas");expect(unavailable.status()).toBe(503);
});
