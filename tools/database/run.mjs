import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import ts from "typescript";
import { createNodeHost, findLanguage, introspect } from "@supabase/typegen";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempRoot = path.join(root, ".database-tests");
await mkdir(tempRoot, { recursive: true });
const directory = await mkdtemp(path.join(tempRoot, "run-"));
if (!directory.startsWith(tempRoot + path.sep)) throw new Error("Directorio local inválido.");
const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => { const value = probe.address().port; probe.close(() => resolve(value)); });
});
const dbName = `activant_dbtest_${Date.now()}`;
const password = "activant-fixture-only-local"; // Solo clúster de pruebas nuevo, sin secretos reales.
const database = new EmbeddedPostgres({
  databaseDir: path.join(directory, "cluster"), port, user: "postgres", password,
  authMethod: "scram-sha-256", persistent: true, createPostgresUser: false,
  postgresFlags: ["-h", "127.0.0.1", "-c", "max_connections=80", "-c", "timezone=UTC"],
  onLog: () => {}, onError: () => {},
});
let client;
let started = false;
let failures = false;
const newClient = async () => {
  // No acepta URLs remotas ni variables de conexión: siempre nuestro clúster nuevo.
  const result = new pg.Client({ host: "127.0.0.1", port, user: "postgres", password, database: dbName });
  await result.connect();
  return result;
};
try {
  await database.initialise();
  await database.start();
  started = true;
  await database.createDatabase(dbName);
  client = await newClient();
  console.log((await client.query("select version() as version")).rows[0].version);
  await client.query(await readFile(path.join(root, "tests/database/bootstrap.sql"), "utf8"));
  const migrations = (await readdir(path.join(root, "supabase/migrations"))).filter((name) => name.endsWith(".sql")).sort();
  for (const name of migrations) {
    try { await client.query(await readFile(path.join(root, "supabase/migrations", name), "utf8")); }
    catch (error) { throw new Error(`Falló migración ${name}: ${error.message}`, { cause: error }); }
    if (name === "20261113120000_create_profiles.sql") {
      await client.query("update public.profiles set is_active=true where id='20000000-0000-4000-8000-000000000900'");
    }
    console.log(`Aplicada: ${name}`);
  }
  if (!process.argv.includes("--smoke")) {
    const { runDatabaseTests } = await import("../../tests/database/policies.mjs");
    await runDatabaseTests({ client, newClient, root });
    const { runBookingTests } = await import("../../tests/database/bookings.mjs");
    await runBookingTests({ client, newClient, root });
    const { runAttendanceTests } = await import("../../tests/database/attendance.mjs");
    await runAttendanceTests({ client, newClient, root });
    const { runProgramTests } = await import("../../tests/database/program.mjs");
    await runProgramTests({ client, newClient, root });
    const { runWaitlistTests } = await import("../../tests/database/waitlist.mjs");
    await runWaitlistTests({ client, newClient, root });
    const { runLibraryAdminTests } = await import("../../tests/database/library-admin.mjs");
    await runLibraryAdminTests({ client, newClient, root });
    const { runSecurityAuditTests } = await import("../../tests/database/security-audit.mjs");
    await runSecurityAuditTests({ client, root });
  }
  const pool = new pg.Pool({ host: "127.0.0.1", port, user: "postgres", password, database: dbName, max: 4 });
  let metadata;
  try { metadata = await introspect(pool, { includedSchemas: ["public"] }); }
  finally { await pool.end(); }
  const language = findLanguage("typescript");
  const host = createNodeHost({ cwd: root, format: async (code) => ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(ts.createSourceFile("database.types.ts", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)) });
  const types = await language.generate(metadata, { "detect-one-to-one-relationships": true }, host);
  const target = path.join(root, "src/lib/supabase/database.types.ts");
  if (process.argv.includes("--check-types")) {
    if (await readFile(target, "utf8") !== types) throw new Error("Los tipos no coinciden con las migraciones. Ejecuta npm run db:types.");
    console.log("Tipos generados por Supabase: coinciden con el esquema.");
  } else if (process.argv.includes("--types")) {
    await writeFile(target, types, "utf8");
    console.log("Tipos generados por @supabase/typegen desde PostgreSQL migrado.");
  }
  await writeFile(path.join(directory, "schema-types.ts"), types, "utf8");
} catch (error) {
  failures = true;
  console.error(error);
} finally {
  await client?.end();
  if (started) await database.stop();
  console.log("Clúster de pruebas detenido. Artefactos locales conservados en .database-tests/.");
}
if (failures) process.exitCode = 1;
