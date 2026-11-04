// Prepara el puente con Google Calendar y Gmail.
//   npm run google            → crea google/Lisa-listo.gs con tu clave y tus correos, y lo copia al portapapeles
//   npm run google -- probar  → revisa que el script conteste (sin crear nada en tu calendario)
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { RAIZ, guardarEnv, leerEnv } from "./_util.mjs";
import { leerDatos, rutaDatos, esEjemplo } from "./armar-prompt.mjs";

const vars = leerEnv();

if (process.argv.includes("probar")) {
  if (!vars.GOOGLE_SCRIPT_URL) {
    console.error("\nFalta GOOGLE_SCRIPT_URL. Corre: npm run claves -- GOOGLE_SCRIPT_URL\n");
    process.exit(1);
  }
  const r = await fetch(vars.GOOGLE_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ secreto: vars.LISA_SECRETO_GOOGLE, accion: "salud" }),
    redirect: "follow",
  });
  const texto = await r.text();
  let j;
  try {
    j = JSON.parse(texto);
  } catch {
    console.error("\nGoogle no contestó como esperaba. Lo más común:");
    console.error("- En 'Quién tiene acceso' no quedó 'Cualquier usuario'.");
    console.error("- Se pegó el link del editor y no el de la aplicación web (el bueno termina en /exec).");
    console.error(`Respuesta (${r.status}): ${texto.slice(0, 200)}\n`);
    process.exit(1);
  }
  if (!j.ok) {
    console.error(`\nEl script contestó, pero con un error: ${j.error}`);
    if (/clave/.test(j.error)) console.error("La clave no coincide: corre npm run google otra vez y pega el código nuevo en el script (y vuelve a implementar).");
    console.error();
    process.exit(1);
  }
  console.log(`\n✅ Google conectado. Calendario: ${j.calendario}. Correos que quedan hoy: ${j.correosHoy}.\n`);
  process.exit(0);
}

const archivo = rutaDatos();
if (esEjemplo(archivo)) {
  console.error("\nTodavía no hay negocio/datos.json (la entrevista de la fase 1). Hazla primero.\n");
  process.exit(1);
}
const datos = leerDatos(archivo);
const correos = String(datos.CORREOS_EQUIPO || "").split(/[,\s]+/).filter((c) => c.includes("@"));
if (!correos.length) {
  console.error("\nFalta CORREOS_EQUIPO en negocio/datos.json (a qué correo le llegan los avisos).\n");
  process.exit(1);
}
vars.LISA_SECRETO_GOOGLE ||= crypto.randomBytes(24).toString("base64url");
guardarEnv(vars);

const codigo = fs
  .readFileSync(path.join(RAIZ, "google", "Lisa.gs"), "utf8")
  .replace("__SECRETO__", vars.LISA_SECRETO_GOOGLE)
  .replace("__CORREOS__", correos.join(","))
  .replace("__CALENDARIO__", datos.CALENDARIO || "primary");
const listo = path.join(RAIZ, "google", "Lisa-listo.gs");
fs.writeFileSync(listo, codigo, { mode: 0o600 });

const copiar = process.platform === "win32" ? ["clip"] : process.platform === "darwin" ? ["pbcopy"] : ["xclip", "-selection", "clipboard"];
const r = spawnSync(copiar[0], copiar.slice(1), { input: codigo, shell: process.platform === "win32" });
console.log(`\nListo: el código de tu script está en ${path.relative(RAIZ, listo)} (no se sube a GitHub, tiene tu clave).`);
console.log(r.status === 0 ? "Ya quedó copiado: solo tienes que pegarlo (Ctrl+V o Cmd+V) en script.google.com.\n" : "Ábrelo, copia todo y pégalo en script.google.com.\n");
console.log(`Los avisos le van a llegar a: ${correos.join(", ")}\n`);
