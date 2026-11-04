// Crea o actualiza a Lisa en Retell: su cerebro (prompt, modelo y herramientas), su voz y su aviso de fin de llamada.
// Crear y actualizar el agente no cuesta: Retell cobra solo los minutos de llamada y el número.
//   npm run agente
// Cada vez que cambies lo que sabe Lisa (negocio/*.md o conocimiento/), vuelve a correrlo.
import { guardarEnv, leerEnv, requerir } from "./_util.mjs";
import { armarPrompt, esEjemplo, leerDatos, rutaDatos, saludo } from "./armar-prompt.mjs";
import { paraRetell } from "./herramientas.mjs";

const vars = leerEnv();
requerir(vars, "RETELL_API_KEY", "LISA_URL");
const archivo = rutaDatos();
if (esEjemplo(archivo)) {
  console.error("\nTodavía no hay negocio/datos.json (la entrevista de la fase 1). Hazla primero.\n");
  process.exit(1);
}
const datos = leerDatos(archivo);

async function retell(metodo, ruta, cuerpo) {
  const r = await fetch(`https://api.retellai.com${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${vars.RETELL_API_KEY}`, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Retell ${metodo} ${ruta} → ${r.status}: ${texto.slice(0, 400)}`);
  return texto ? JSON.parse(texto) : {};
}

// claude-5.5-haiku: en el simulador (2026-11-04) pasó 15 de 18 casos contra 9 de 18 de Haiku 4.5, y cuesta menos por minuto.
const MODELO = vars.LISA_MODELO || "claude-5.5-haiku";
const cerebro = {
  model_config: { type: "cascading", primary: { model: MODELO, tier: "standard" }, temperature: 0.15 },
  start_speaker: "agent",
  begin_message: saludo(datos),
  general_prompt: armarPrompt(archivo),
  general_tools: paraRetell({
    url: vars.LISA_URL.replace(/\/+$/, ""),
    telefonoTransferir: datos.TELEFONO_TRANSFERIR || "",
    contacto: datos.CONTACTO_HUMANO,
  }),
};

/** La ciudad, las ciudades de la zona y los nombres de la compañía y del agente, para que el oído de Retell los espere. */
function palabrasDeLaZona(d) {
  const zona = String(d.ZONA_SERVICIO || "").match(/\(([^)]*)\)/)?.[1] || "";
  const sueltas = [d.CIUDAD, d.COMPANIA, d.NOMBRE_AGENTE, ...zona.split(/,| y | and /), ...String(d.PALABRAS_CLAVE || "").split(",")];
  const limpias = sueltas
    .map((p) => String(p || "").replace(/\b(y )?alrededores\b|\.\.\./gi, "").trim())
    .filter((p) => p.length > 2);
  return [...new Set(limpias)].slice(0, 100);
}

const voz = {
  agent_name: `${datos.NOMBRE_AGENTE} · ${datos.COMPANIA}`,
  voice_id: vars.LISA_VOZ || "cartesia-Cleo",
  ...(vars.LISA_VOZ ? {} : { voice_model: "sonic-3.6" }),
  language: ["en-US", "es-419"],
  // Las direcciones se oían mal por teléfono (en la primera llamada real, "Wortham" salió "Wharton" y el número de la casa
  // tomó 4 intentos). Modo preciso del oído y las ciudades de la zona como palabras que debe esperar.
  stt_mode: vars.LISA_OIDO || "accurate",
  boosted_keywords: palabrasDeLaZona(datos),
  timezone: datos.ZONA_HORARIA || "America/Chicago",
  // Una pausa corta antes del saludo: sin ella se corta el principio (nos pasó con Sofía).
  begin_message_delay_ms: 800,
  end_call_after_silence_ms: 30000,
  max_call_duration_ms: 15 * 60000,
  webhook_url: `${vars.LISA_URL.replace(/\/+$/, "")}/api/retell`,
  webhook_events: ["call_analyzed"],
  post_call_analysis_model: MODELO,
  post_call_analysis_data: [
    { type: "system-presets", name: "call_summary" },
    { type: "string", name: "nombre", description: "Nombre y apellido del cliente, si los dijo." },
    { type: "string", name: "direccion", description: "Dirección de la propiedad con ZIP, si la dijo." },
    { type: "enum", name: "caso", description: "Qué necesitaba.", choices: ["gotera", "tormenta", "reemplazo", "otro", "no_aplica"] },
    { type: "boolean", name: "urgente", description: "true si le estaba entrando agua o era una emergencia." },
  ],
};

console.log("\n=== 1. El cerebro de Lisa (prompt y herramientas) ===");
let llm;
if (vars.RETELL_LLM_ID) {
  llm = await retell("PATCH", `/update-retell-llm/${vars.RETELL_LLM_ID}`, cerebro);
  console.log(`  Actualizado (${vars.RETELL_LLM_ID})`);
} else {
  llm = await retell("POST", "/create-retell-llm", cerebro);
  vars.RETELL_LLM_ID = llm.llm_id;
  guardarEnv(vars);
  console.log(`  Creado (${llm.llm_id})`);
}

console.log("\n=== 2. El agente (voz, idiomas y aviso de fin de llamada) ===");
let agente;
const motor = { response_engine: { type: "retell-llm", llm_id: vars.RETELL_LLM_ID } };
if (vars.RETELL_AGENT_ID) {
  agente = await retell("PATCH", `/update-agent/${vars.RETELL_AGENT_ID}`, { ...voz, ...motor });
  console.log(`  Actualizado (${vars.RETELL_AGENT_ID})`);
} else {
  agente = await retell("POST", "/create-agent", { ...voz, ...motor });
  vars.RETELL_AGENT_ID = agente.agent_id;
  guardarEnv(vars);
  console.log(`  Creado (${agente.agent_id})`);
}

console.log("\n=== 3. Publicar la versión nueva ===");
// Los números apuntan a la última versión publicada: así un cambio a medias nunca llega a una llamada real.
await retell("POST", `/publish-agent-version/${vars.RETELL_AGENT_ID}`, {
  version: agente.version,
  version_title: new Date().toISOString().slice(0, 16).replace("T", " "),
});
console.log(`  Versión ${agente.version} publicada ✓`);

console.log(`\nLisa ya existe en Retell. Para oírla sin número: dashboard.retellai.com → Agents → ${voz.agent_name} → Test (llamada desde el navegador, cuesta lo mismo que una llamada: unos 10 centavos por minuto).`);
console.log(vars.RETELL_NUMERO ? `Número: ${vars.RETELL_NUMERO} (ya apunta a la última versión publicada).\n` : "Todavía no tiene número: npm run numero (fase 5).\n");
