// Sube las claves a Vercel y publica las herramientas de Lisa. Después de esto, Lisa tiene una dirección en internet.
//   npm run publicar                 → proyecto "lisa-llamadas" en Vercel
//   npm run publicar -- otro-nombre  → con otro nombre de proyecto
import fs from "node:fs";
import path from "node:path";
import { RAIZ, correr, guardarEnv, leerEnv, paso, requerir } from "./_util.mjs";
import { agendaDeDatos, esEjemplo, leerDatos, rutaDatos } from "./armar-prompt.mjs";

const vars = leerEnv();
requerir(vars, "RETELL_API_KEY", "GOOGLE_SCRIPT_URL", "LISA_SECRETO_GOOGLE");
const archivo = rutaDatos();
if (esEjemplo(archivo)) {
  console.error("\nTodavía no hay negocio/datos.json (la entrevista de la fase 1). Hazla primero.\n");
  process.exit(1);
}
const datos = leerDatos(archivo);

// Lo que el código necesita saber de la compañía (sin datos de clientes).
const variables = {
  RETELL_API_KEY: vars.RETELL_API_KEY,
  GOOGLE_SCRIPT_URL: vars.GOOGLE_SCRIPT_URL,
  LISA_SECRETO_GOOGLE: vars.LISA_SECRETO_GOOGLE,
  LISA_AGENDA: JSON.stringify(agendaDeDatos(datos)),
  LISA_ZIPS: String(datos.ZIPS ?? ""),
  LISA_COMPANIA: String(datos.COMPANIA),
  LISA_NOMBRE: String(datos.NOMBRE_AGENTE),
};

paso(1, "Conectar esta carpeta con un proyecto de Vercel");
const enlace = correr("npx", ["vercel", "link", "--yes", "--project", process.argv[2] || "lisa-llamadas"]);
if (enlace.status !== 0) {
  console.error("\nNo se pudo conectar con Vercel. ¿Ya iniciaste sesión? Corre: npx vercel login\n");
  process.exit(1);
}
// `vercel link` agrega ".vercel" y ".env*" al final del .gitignore; ".env*" taparía .env.ejemplo.
const gitignore = path.join(RAIZ, ".gitignore");
fs.writeFileSync(gitignore, fs.readFileSync(gitignore, "utf8").replace(/\r?\n\.vercel\r?\n\.env\*\r?\n?$/, "\n"));

paso(2, "Subir las claves a Vercel (producción)");
for (const [nombre, valor] of Object.entries(variables)) {
  if (valor === "") continue;
  correr("npx", ["vercel", "env", "rm", nombre, "production", "--yes"], { silencioso: true });
  // El valor va por la entrada estándar: no queda en el historial de la Terminal.
  const r = correr("npx", ["vercel", "env", "add", nombre, "production", "--yes"], { entrada: valor, silencioso: true });
  if (r.status !== 0) {
    console.error(`\nNo se pudo guardar ${nombre} en Vercel:\n${r.stderr || r.stdout}\n`);
    process.exit(1);
  }
  console.log(`  ${nombre} ✓`);
}

paso(3, "Publicar");
const deploy = correr("npx", ["vercel", "deploy", "--prod", "--yes"], { silencioso: true });
if (deploy.status !== 0) {
  console.error(`\nLa publicación falló:\n${deploy.stderr || deploy.stdout}\n`);
  process.exit(1);
}
const url = (deploy.stdout.match(/https:\/\/[^\s]+\.vercel\.app/g) ?? []).pop();
vars.LISA_URL = url;
guardarEnv(vars);
console.log(`\nLisa está publicada: ${url}`);
console.log(`Para revisar que esté despierta: ${url}/api/salud`);
console.log("Siguiente paso: npm run agente (crea a Lisa en Retell con su voz y sus herramientas).\n");
