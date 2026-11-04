// Prepara el puente con Google Calendar y Gmail.
//   npm run google            → crea google/Lisa-listo.gs con tu clave y tus correos, y lo copia al portapapeles
//   npm run google -- copiar  → lo vuelve a copiar (córrelo justo antes de que la persona pegue)
//   npm run google -- probar  → revisa que el script conteste (sin crear nada en tu calendario)
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { RAIZ, guardarEnv, leerEnv } from "./_util.mjs";
import { leerDatos, rutaDatos, esEjemplo } from "./armar-prompt.mjs";

const vars = leerEnv();
const LISTO = path.join(RAIZ, "google", "Lisa-listo.gs");

const normal = (t) => String(t).replace(/\r\n/g, "\n").trim();

/** Copia el archivo al portapapeles y comprueba que de verdad quedó copiado. */
function copiarAlPortapapeles(archivo) {
  const codigo = fs.readFileSync(archivo, "utf8");
  let copio, leer;
  if (process.platform === "win32") {
    // PowerShell guarda bien los acentos (clip.exe los daña) y deja leer lo copiado para comprobarlo.
    const ps = (cmd) => spawnSync("powershell.exe", ["-NoProfile", "-Command", cmd], { encoding: "utf8" });
    const ruta = archivo.replace(/'/g, "''");
    copio = ps(`Set-Clipboard -Value (Get-Content -Raw -Encoding UTF8 -LiteralPath '${ruta}')`);
    leer = () => ps("[Console]::OutputEncoding = [Text.Encoding]::UTF8; Get-Clipboard -Raw").stdout || "";
  } else if (process.platform === "darwin") {
    copio = spawnSync("pbcopy", [], { input: codigo });
    leer = () => spawnSync("pbpaste", [], { encoding: "utf8" }).stdout || "";
  } else {
    copio = spawnSync("xclip", ["-selection", "clipboard"], { input: codigo });
    leer = () => spawnSync("xclip", ["-selection", "clipboard", "-o"], { encoding: "utf8" }).stdout || "";
  }
  if (copio.error || copio.status !== 0) return false;
  return normal(leer()) === normal(codigo);
}

function avisarCopia(ok) {
  if (ok) {
    console.log("✅ Ya quedó copiado y lo comprobé: solo tiene que pegarlo (Ctrl+V o Cmd+V) en script.google.com.");
    console.log("   Que no copie nada más antes de pegar. Si copia otra cosa, corre: npm run google -- copiar\n");
  } else {
    console.log(`⚠️  No pude copiarlo al portapapeles. Abre ${path.relative(RAIZ, LISTO)}, selecciona todo (Ctrl+A), cópialo (Ctrl+C) y pégalo en script.google.com.\n`);
  }
}

if (process.argv.includes("copiar")) {
  if (!fs.existsSync(LISTO)) {
    console.error("\nTodavía no existe google/Lisa-listo.gs. Corre primero: npm run google\n");
    process.exit(1);
  }
  avisarCopia(copiarAlPortapapeles(LISTO));
  process.exit(0);
}

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
    const pideEntrar = /accounts\.google\.com|ServiceLogin|<html/i.test(texto) || r.status === 401 || r.status === 403;
    console.error("\nGoogle no contestó como esperaba.");
    if (pideEntrar) console.error("Google no deja entrar a Lisa (contesta con una página para iniciar sesión o de permisos). Lo más común:");
    console.error("- En 'Quién tiene acceso' (Who has access) no quedó 'Cualquier usuario' (Anyone).");
    console.error("  Se arregla en Implementar → Administrar implementaciones (Deploy → Manage deployments) → el lápiz → Cualquier usuario (Anyone) → Implementar (Deploy).");
    console.error("- No se tocó ▶ Ejecutar (Run) con la función darPermisos escogida arriba, así que Google no tiene los permisos.");
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
fs.writeFileSync(LISTO, codigo, { mode: 0o600 });

console.log(`\nListo: el código de tu script está en ${path.relative(RAIZ, LISTO)} (no se sube a GitHub, tiene tu clave).`);
console.log(`Los avisos le van a llegar a: ${correos.join(", ")}\n`);
avisarCopia(copiarAlPortapapeles(LISTO));
