import test from "node:test";
import assert from "node:assert/strict";
import { contentSchema, assetSchema, authorizedUrlSchema } from "../../src/modules/library/contracts.ts";
import { adminMutationSchema, reportFiltersSchema, invitationSchema } from "../../src/modules/administration/contracts.ts";
import { createCsv, csvCell } from "../../src/modules/administration/csv.ts";
const id = "99000000-0000-4000-8000-000000000001";
const draft = { id:"", revision:0, title:"Contenido de prueba", description:"Descripción exclusivamente de prueba", category:"movilidad", durationMinutes:"10", coverAssetId:"", videoAssetId:"", externalUrl:"", status:"draft" };
test("borrador sin archivos; publicar requiere portada, recurso único y autorización expresa", () => {
  assert.ok(contentSchema.safeParse(draft).success);
  assert.equal(contentSchema.safeParse({...draft,status:"published"}).success,false);
  const published={...draft,status:"published",coverAssetId:id,externalUrl:"https://example.invalid/video",authorized:"yes"};
  assert.ok(contentSchema.safeParse(published).success);
  for(const patch of [{authorized:undefined},{coverAssetId:""},{videoAssetId:id},{durationMinutes:0},{category:"medicina"}]) assert.equal(contentSchema.safeParse({...published,...patch}).success,false);
});
test("enlaces HTTPS sin credenciales, scripts, espacios ni puertos arbitrarios",()=>{
  for(const value of ["javascript:alert(1)","http://example.invalid/","https://user:pass@example.invalid/","https://example.invalid:8080/","https://example.invalid/a b"]) assert.equal(authorizedUrlSchema.safeParse(value).success,false);
  assert.equal(authorizedUrlSchema.parse("https://example.invalid"),"https://example.invalid/");
});
test("archivos autorizados con límites diferentes para portada y video, sin SVG activo",()=>{
  assert.ok(assetSchema.safeParse({kind:"cover",mimeType:"image/png",sizeBytes:5242880}).success);
  assert.ok(assetSchema.safeParse({kind:"video",mimeType:"video/mp4",sizeBytes:104857600}).success);
  for(const patch of [{mimeType:"image/svg+xml"},{sizeBytes:5242881},{sizeBytes:0},{kind:"video",mimeType:"image/png"}]) assert.equal(assetSchema.safeParse({kind:"cover",mimeType:"image/png",sizeBytes:100,...patch}).success,false);
});
test("reportes acotados a 93 días inclusivos y UUID, identidad administrativa nunca desde el formulario",()=>{
  assert.ok(reportFiltersSchema.safeParse({desde:"2026-01-01",hasta:"2026-04-03"}).success);
  for(const patch of [{hasta:"2026-04-04"},{hasta:"2025-12-31"},{franja:"cualquiera"},{desde:"2026-02-30"}]) assert.equal(reportFiltersSchema.safeParse({desde:"2026-01-01",hasta:"2026-01-31",...patch}).success,false);
  const parsed=adminMutationSchema.parse({operation:"role",userId:id,role:"admin",enabled:"true",actor_id:"otro"});
  assert.equal("actor_id" in parsed,false);
  assert.equal(adminMutationSchema.safeParse({...parsed,role:"superadmin"}).success,false);
  assert.equal(invitationSchema.parse({requestId:id,email:" Test@Example.invalid "}).email,"test@example.invalid");
});
test("CSV conserva Unicode, comas, comillas y saltos; neutraliza fórmulas y no fabrica nulos",()=>{
  assert.equal(csvCell('a,"b"\nc'),'"a,""b""\nc"');
  for(const value of ["=CMD()"," +1","\t@sum(1)","-2","\r\n=1"]) assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell(null),'""');
  assert.equal(createCsv(["Título","Cantidad"],[["Movilidad",2]]),'\uFEFF"Título","Cantidad"\r\n"Movilidad","2"\r\n');
});
