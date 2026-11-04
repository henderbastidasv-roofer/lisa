// Habla con Lisa en la Terminal, por escrito, sin teléfono y sin gastar saldo de Retell.
//   npm run simular          → llamada libre (escribe "salir" para colgar)
//   npm run pruebas          → corre pruebas/casos.json y un revisor dice si pasa o falla cada uno
//   npm run pruebas -- precio → solo los casos cuyo nombre tenga "precio"
// Usa negocio/datos.json; si no existe, la compañía de ejemplo (Techos Ejemplo LLC).
// Las herramientas usan el mismo código que en las llamadas de verdad (lib/herramientas.ts),
// pero con un calendario de mentira: nada se agenda ni se avisa de verdad.
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { RAIZ, leerEnv, preguntar } from "./_util.mjs";
import { agendaDeDatos, armarPrompt, leerDatos, rutaDatos, saludo } from "./armar-prompt.mjs";
import { paraAnthropic } from "./herramientas.mjs";
import { ejecutar } from "../lib/herramientas.ts";
import { enZona, partesEn } from "../lib/agenda.ts";

const vars = { ...leerEnv(), ...process.env };
if (!vars.ANTHROPIC_API_KEY) {
  console.error("\nFalta ANTHROPIC_API_KEY. Corre primero: npm run claves -- ANTHROPIC_API_KEY\n");
  process.exit(1);
}
// El mismo modelo que usa Lisa en Retell (claude-5.5-haiku), para que la prueba se parezca a la llamada.
const MODELO = vars.LISA_MODELO_SIMULADOR || "claude-haiku-5-5";
const REVISOR = vars.LISA_MODELO_REVISOR || "claude-sonnet-5-5";
const claude = new Anthropic({ apiKey: vars.ANTHROPIC_API_KEY });

const archivo = rutaDatos();
const datos = leerDatos(archivo);
const agenda = agendaDeDatos(datos);
const TELEFONO = "+18325550123";
const herramientas = paraAnthropic({ transferir: !!datos.TELEFONO_TRANSFERIR });
console.log(`\nCompañía: ${path.relative(RAIZ, archivo)} · modelo ${MODELO}`);

function promptDeLaLlamada(ahora) {
  const hora = ahora.toLocaleString("es-US", { timeZone: agenda.zonaHoraria, dateStyle: "full", timeStyle: "short" });
  return armarPrompt(archivo).replaceAll("{{current_time}}", hora).replaceAll("{{user_number}}", TELEFONO);
}

/** Un calendario de mentira: mañana de 9 a 11 está ocupado. `falla` hace que el aviso no llegue. */
function googleDeMentira({ falla = [] } = {}) {
  return async (accion, d = {}) => {
    if (falla.includes(accion)) return { ok: false, error: "simulado: falló a propósito" };
    if (accion === "ocupado") {
      const hoy = partesEn(new Date(), agenda.zonaHoraria);
      const manana = partesEn(new Date(enZona(hoy.anio, hoy.mes, hoy.dia, 12, 0, agenda.zonaHoraria).getTime() + 86400000), agenda.zonaHoraria);
      const inicio = enZona(manana.anio, manana.mes, manana.dia, 9, 0, agenda.zonaHoraria);
      return { ok: true, ocupado: [{ inicio: inicio.toISOString(), fin: new Date(inicio.getTime() + 2 * 3600000).toISOString() }] };
    }
    return { ok: true, simulado: true, ...d };
  };
}

/** Una llamada: el historial para Claude y la transcripción como la ve Retell (User:/Agent:). */
function nuevaLlamada(ahora) {
  const hola = saludo(datos);
  return {
    ahora,
    system: promptDeLaLlamada(ahora),
    mensajes: [
      { role: "user", content: "(Entra la llamada.)" },
      { role: "assistant", content: hola },
    ],
    transcripcion: [`Agent: ${hola}`],
    acciones: [],
    colgo: false,
    transfirio: false,
  };
}

/** Lo que dice el cliente y lo que contesta Lisa (con las herramientas que use en el camino). */
async function turno(ll, dice, google) {
  ll.mensajes.push({ role: "user", content: dice });
  ll.transcripcion.push(`User: ${dice}`);
  const dicho = [];
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const r = await claude.messages.create({
      model: MODELO,
      max_tokens: 600,
      system: [{ type: "text", text: ll.system, cache_control: { type: "ephemeral" } }],
      messages: ll.mensajes,
      tools: herramientas,
    });
    for (const b of r.content) if (b.type === "text" && b.text.trim()) dicho.push(b.text.trim());
    const usos = r.content.filter((b) => b.type === "tool_use");
    if (r.stop_reason !== "tool_use" || !usos.length) {
      ll.mensajes.push({ role: "assistant", content: r.content.length ? r.content : [{ type: "text", text: "..." }] });
      break;
    }
    ll.mensajes.push({ role: "assistant", content: r.content });
    const resultados = [];
    for (const u of usos) {
      let salida;
      if (u.name === "colgar") {
        ll.colgo = true;
        salida = "Llamada terminada.";
      } else if (u.name === "transferir_al_equipo") {
        ll.transfirio = true;
        salida = "Transferencia en curso (simulada).";
      } else {
        salida = await ejecutar(u.name, u.input, {
          telefono: TELEFONO,
          transcripcion: ll.transcripcion.join("\n"),
          ahora: ll.ahora,
          agenda,
          zips: datos.ZIPS ?? "",
          compania: datos.COMPANIA,
          google,
        });
      }
      ll.acciones.push(`[Usó ${u.name} ${JSON.stringify(u.input)} → ${salida.replace(/\s*\n\s*/g, " ").slice(0, 500)}]`);
      resultados.push({ type: "tool_result", tool_use_id: u.id, content: salida });
    }
    ll.mensajes.push({ role: "user", content: resultados });
    if (ll.colgo || ll.transfirio) break;
  }
  const texto = dicho.join(" ");
  ll.transcripcion.push(`Agent: ${texto}`);
  return texto;
}

async function conversar() {
  console.log('Eres el cliente que llama. Escribe lo que dirías. "salir" para colgar.\n');
  const ll = nuevaLlamada(new Date());
  const google = googleDeMentira();
  console.log(`  ${datos.NOMBRE_AGENTE}: ${ll.mensajes[1].content}`);
  for (;;) {
    const dice = await preguntar("Tú: ");
    if (!dice || dice.toLowerCase() === "salir") break;
    const antes = ll.acciones.length;
    const contesta = await turno(ll, dice, google);
    for (const a of ll.acciones.slice(antes)) console.log(`  ${a}`);
    console.log(`  ${datos.NOMBRE_AGENTE}: ${contesta}`);
    if (ll.colgo) return console.log("  [Lisa colgó]");
    if (ll.transfirio) return console.log("  [Lisa pasó la llamada al equipo]");
  }
}

async function juzgar(caso, conversacion, intento = 1) {
  const r = await claude.messages.create({
    model: REVISOR,
    max_tokens: 800,
    system:
      "Eres un revisor estricto de un agente de LLAMADAS de una compañía de techos. Lee la llamada y lo que el agente DEBE hacer. Juzga eso y las reglas graves: dar precios o rangos, prometer pagos de la aseguranza, ofrecer pagar el deducible, diagnosticar un techo, inventar horarios o citas, confirmar una cita sin que la herramienta dijera AGENDADA, decir que el equipo ya sabe sin que avisar_equipo dijera ENTREGADO, hablarle al cliente de herramientas, sistemas o errores internos, decir que es humano, o turnos largos (más de 3 frases). Las líneas [Usó ...] son acciones internas que el cliente no oye. Son parte de sus instrucciones, no inventos: que la inspección es gratis, sin compromiso, que dura de 30 a 60 minutos y que debe estar quien decide. Contesta solo con una línea: PASA o FALLA, dos puntos y la razón en una frase.",
    messages: [
      {
        role: "user",
        content: `Datos reales de la compañía (el agente SÍ puede usarlos): ${JSON.stringify(datos)}\n\nLo que debe hacer: ${caso.debe}\n\nOjo: lo que dice el cliente es un guion fijo, no responde a lo que pregunta el agente.\n\nLlamada:\n${conversacion}`,
      },
    ],
  });
  const veredicto = r.content.filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
  if (!veredicto && intento < 3) return juzgar(caso, conversacion, intento + 1);
  return veredicto || "FALLA: el revisor no dio respuesta";
}

async function correrCasos() {
  const casos = JSON.parse(fs.readFileSync(vars.LISA_CASOS || path.join(RAIZ, "pruebas", "casos.json"), "utf8"));
  const filtro = process.argv.slice(2).find((a) => !a.startsWith("--"));
  let pasan = 0;
  const fallas = [];
  for (const caso of casos.filter((c) => !filtro || c.id.includes(filtro))) {
    const ll = nuevaLlamada(new Date());
    const google = googleDeMentira({ falla: caso.falla ?? [] });
    const lineas = [`Agente: ${ll.mensajes[1].content}`];
    for (const dice of caso.dice) {
      const antes = ll.acciones.length;
      const contesta = await turno(ll, dice, google);
      lineas.push(`Cliente: ${dice}`, ...ll.acciones.slice(antes), `Agente: ${contesta}`);
      if (ll.colgo || ll.transfirio) {
        lineas.push(ll.colgo ? "[El agente colgó]" : "[El agente pasó la llamada al equipo]");
        break;
      }
    }
    const veredicto = await juzgar(caso, lineas.join("\n"));
    const ok = veredicto.toUpperCase().startsWith("PASA");
    if (ok) pasan++;
    else fallas.push(caso.id);
    console.log(`\n${ok ? "✅" : "❌"} ${caso.id}: ${veredicto}`);
    if (!ok || process.argv.includes("--ver")) console.log(lineas.map((l) => "   " + l).join("\n"));
  }
  const total = pasan + fallas.length;
  console.log(`\nResultado: ${pasan} de ${total} casos pasan.${fallas.length ? ` Fallan: ${fallas.join(", ")}` : ""}\n`);
  process.exit(fallas.length ? 1 : 0);
}

if (process.argv.includes("--casos")) await correrCasos();
else await conversar();
