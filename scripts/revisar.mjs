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

// La última llamada (o prueba desde el navegador): ¿las herramientas contestaron, o Vercel las rechazó?
// Si la RETELL_API_KEY no es la de la etiqueta "webhook", Retell firma con otra clave y Vercel dice "firma inválida":
// Lisa contesta, pero no ve la agenda ni deja avisos. Revisarlo no cuesta.
if (vars.RETELL_API_KEY && vars.RETELL_AGENT_ID) {
  const retell = async (metodo, ruta, cuerpo) => {
    const r = await fetch(`https://api.retellai.com${ruta}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${vars.RETELL_API_KEY}`, "Content-Type": "application/json" },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    if (!r.ok) throw new Error(`Retell ${r.status}`);
    return r.json();
  };
  const unaLlamada = async (id) => {
    for (const ruta of [`/v2/get-call/${id}`, `/v1/get-call/${id}`, `/get-call/${id}`]) {
      try {
        return await retell("GET", ruta);
      } catch {}
    }
    throw new Error("no pude abrir la llamada");
  };
  try {
    const lista = await retell("POST", "/v3/list-calls", { sort_order: "descending", limit: 20 });
    const items = Array.isArray(lista) ? lista : lista.items || [];
    const ultima = items.find((c) => c.agent_id === vars.RETELL_AGENT_ID);
    if (!ultima) {
      console.log("⬜ Herramientas en una llamada: todavía no hay llamadas para revisar");
    } else {
      const llamada = await unaLlamada(ultima.call_id);
      const resultados = (llamada.transcript_with_tool_calls || [])
        .filter((t) => t.role === "tool_call_result")
        .map((t) => String(t.content || ""));
      const conocidas = /HORARIOS LIBRES|SIN HORARIOS|AGENDADA|NO SE AGENDÓ|ENTREGADO|ERROR:/;
      if (!resultados.length) {
        console.log("⬜ Herramientas en una llamada: en la última llamada Lisa no usó ninguna (en la prueba, pide una inspección)");
      } else if (resultados.some((t) => /firma|401|unauthori/i.test(t)) || !resultados.some((t) => conocidas.test(t))) {
        ok(false, "Herramientas en una llamada: Vercel las rechazó. La RETELL_API_KEY no es la de la etiqueta 'webhook'.");
        console.log("   Arreglo: Retell → Settings → API Keys → copia la que dice 'webhook', corre npm run claves -- RETELL_API_KEY y después npm run publicar.");
      } else {
        ok(true, "Herramientas en una llamada: contestaron bien en la última llamada (la clave de Retell es la de webhook)");
      }
    }
  } catch (e) {
    console.log(`⬜ Herramientas en una llamada: no pude revisar las llamadas en Retell (${e.message})`);
  }
}
ok(!!vars.RETELL_NUMERO, `Número de teléfono (fase 5): ${vars.RETELL_NUMERO || "todavía no"}`);
console.log();
