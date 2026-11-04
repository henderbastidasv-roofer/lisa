// Pide cada clave en la Terminal (sin mostrarla) y la guarda en .env.local.
// Las claves NUNCA se pegan en el chat de Claude: solo aquí.
import crypto from "node:crypto";
import { guardarEnv, leerEnv, preguntar } from "./_util.mjs";

const CLAVES = [
  {
    nombre: "ANTHROPIC_API_KEY",
    oculto: true,
    ayuda: "Clave de Anthropic (empieza con sk-ant-). Solo la usa el simulador. La sacas en console.anthropic.com → API Keys.",
    valida: (v) => v.startsWith("sk-ant-"),
  },
  {
    nombre: "RETELL_API_KEY",
    oculto: true,
    ayuda: "Clave de Retell: dashboard.retellai.com → Settings → API Keys. Usa la que tiene la etiqueta 'webhook' (empieza con key_).",
    valida: (v) => v.length > 20,
  },
  {
    nombre: "GOOGLE_SCRIPT_URL",
    ayuda: "El link de tu script de Google (Implementar → Aplicación web). Termina en /exec.",
    valida: (v) => /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(v),
    limpiar: (v) => v.trim().replace(/\?.*$/, ""),
  },
];

// npm run claves                         → pide todas
// npm run claves -- RETELL_API_KEY       → pide solo las que nombres
const soloEstas = process.argv.slice(2);
const vars = leerEnv();
console.log("\nVoy a pedirte cada clave. Lo que escribas en las ocultas se ve como ****.");
console.log("Si una ya está guardada o todavía no la tienes, presiona Enter para pasar a la siguiente.\n");

for (const c of soloEstas.length ? CLAVES.filter((c) => soloEstas.includes(c.nombre)) : CLAVES) {
  console.log(`\n${c.ayuda}`);
  for (;;) {
    const ya = vars[c.nombre] ? " (ya guardada, Enter para dejarla)" : "";
    let v = await preguntar(`${c.nombre}${ya}: `, { oculto: !!c.oculto });
    if (!v) break;
    if (c.limpiar) v = c.limpiar(v);
    if (c.valida(v)) {
      vars[c.nombre] = v;
      break;
    }
    console.log("  Eso no se ve bien. Revísalo y pégalo otra vez.");
  }
}

// La clave que comparte Lisa con tu script de Google. La crea la computadora; nadie la tiene que copiar.
vars.LISA_SECRETO_GOOGLE ||= crypto.randomBytes(24).toString("base64url");
guardarEnv(vars);
console.log("\nListo: las claves quedaron en .env.local (ese archivo nunca se sube a GitHub).\n");
