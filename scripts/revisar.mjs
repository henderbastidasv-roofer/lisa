// Revisa que todo esté en su lugar. Claude Code lo corre al final de cada fase.
import fs from "node:fs";
import path from "node:path";
import { RAIZ, leerEnv } from "./_util.mjs";

const vars = leerEnv();
const ok = (b, texto) => console.log(`${b ? "✅" : "⬜"} ${texto}`);

ok(fs.existsSync(path.join(RAIZ, "node_modules")), "Dependencias instaladas (npm install)");
ok(fs.existsSync(path.join(RAIZ, "negocio", "datos.json")), "Entrevista hecha (negocio/datos.json)");
ok(!!vars.ANTHROPIC_API_KEY, "Clave de Anthropic para el simulador (fase 2)");
ok(!!vars.RETELL_API_KEY, "Clave de Retell (fase 3)");

let google = false;
if (vars.GOOGLE_SCRIPT_URL) {
  try {
    const r = await fetch(vars.GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secreto: vars.LISA_SECRETO_GOOGLE, accion: "salud" }),
      redirect: "follow",
    });
    google = (await r.json()).ok === true;
  } catch {}
}
ok(google, `Google Calendar y Gmail conectados (fase 3)${vars.GOOGLE_SCRIPT_URL && !google ? ": el script no contesta bien, corre npm run google -- probar" : ""}`);

let despierta = false;
if (vars.LISA_URL) {
  try {
    despierta = (await fetch(`${vars.LISA_URL}/api/salud`)).ok;
  } catch {}
}
ok(despierta, `Lisa publicada en Vercel (fase 4)${vars.LISA_URL ? `: ${vars.LISA_URL}` : ""}`);
ok(!!vars.RETELL_AGENT_ID, "Lisa creada en Retell (npm run agente)");
ok(!!vars.RETELL_NUMERO, `Número de teléfono (fase 5): ${vars.RETELL_NUMERO || "todavía no"}`);
console.log();
