import { deploymentIssues } from "../../src/lib/deployment.ts";
const issues=deploymentIssues(process.env);
if(issues.length){console.error(`Entorno inválido. Revisa: ${issues.join(", ")}. No se muestran valores.`);process.exitCode=1;}
else console.log(`Entorno ${process.env.APP_ENV} válido en formato. No verifica SMTP, permisos remotos ni migraciones.`);
