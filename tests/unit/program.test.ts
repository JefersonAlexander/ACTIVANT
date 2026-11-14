import test from "node:test";
import assert from "node:assert/strict";
import { programMutationSchema,programError } from "../../src/modules/program/contracts.ts";
const uuid="94000000-0000-4000-8000-000000000001";
test("movimientos requieren UUID, motivo permitido, importe entero no cero y clave idempotente",()=>{
 const input={operation:"adjust",userId:uuid,amount:"-10",reason:"correction",requestId:uuid};assert.ok(programMutationSchema.safeParse(input).success);
 for(const patch of [{amount:"0"},{amount:"0.1"},{amount:"1000001"},{reason:"diagnóstico"},{requestId:"duplicate"}])assert.equal(programMutationSchema.safeParse({...input,...patch}).success,false);
});
test("cierre y calendario exigen verificación explícita y fechas sin hora",()=>{
 assert.equal(programMutationSchema.safeParse({operation:"closeout",slotId:uuid}).success,false);
 const input={operation:"calendar",start:"2027-01-01",end:"2027-01-31",nonWorking:"2027-01-01,2027-01-11",verified:"yes"};
 const parsed=programMutationSchema.safeParse(input);assert.ok(parsed.success);assert.deepEqual(parsed.data.operation==="calendar"?parsed.data.nonWorking:[],["2027-01-01","2027-01-11"]);
 assert.equal(programMutationSchema.safeParse({...input,start:"2027-01-01T00:00:00Z"}).success,false);
 assert.match(programError({details:"__proto__"}),/No pudimos/);assert.match(programError({details:"evidence_required"}),/evidencia/);
});
