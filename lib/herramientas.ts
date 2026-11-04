// Lo que hace cada herramienta de Lisa durante la llamada.
// Lo usan api/herramientas.ts (en vivo, con el Google de la compañía) y scripts/simular.mjs
// (en pruebas, con un Google de mentira), así las pruebas revisan el mismo código que contesta las llamadas.
import { dentroDelHorario, dosOpciones, enZona, isoEnZona, partesEn, comoSeDice, type Agenda, type Ocupado } from "./agenda.js";
import { ordenDeTrabajo, problemaParaAgendar, type DatosCita } from "./reglas.js";
import type { RespuestaGoogle } from "./google.js";

export type Contexto = {
  telefono: string; // el número desde el que llama el cliente
  transcripcion: string; // lo que se ha dicho, con líneas "User:" y "Agent:"
  ahora: Date;
  agenda: Agenda;
  zips: string;
  compania: string;
  google: (accion: string, datos?: Record<string, unknown>) => Promise<RespuestaGoogle>;
};

const idiomaDe = (v: unknown): "es" | "en" => (String(v ?? "").toLowerCase().startsWith("en") ? "en" : "es");

async function verHorarios(args: any, c: Contexto): Promise<string> {
  const hasta = new Date(c.ahora.getTime() + (c.agenda.diasAdelante + 1) * 86400000);
  const r = await c.google("ocupado", { desde: c.ahora.toISOString(), hasta: hasta.toISOString() });
  if (!r.ok) {
    return "ERROR: no se pudo ver la agenda. No inventes horarios ni le cuentes al cliente del error: toma sus datos y usa avisar_equipo (tipo llamar) para que el equipo lo llame a agendar.";
  }
  const parte = /tarde|afternoon|pm/i.test(String(args?.parte_del_dia ?? "")) ? "tarde" : /mañana|manana|morning|am/i.test(String(args?.parte_del_dia ?? "")) ? "manana" : undefined;
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(String(args?.dia ?? "")) ? String(args.dia) : undefined;
  const opciones = dosOpciones(c.agenda, (r.ocupado as Ocupado[]) ?? [], c.ahora, { parte, dia }, idiomaDe(args?.idioma));
  if (!opciones.length) {
    return "SIN HORARIOS: no hay horarios libres en los próximos días. No inventes uno: dile que el equipo lo llama para buscarle un espacio y usa avisar_equipo (tipo horario_especial).";
  }
  return [
    "HORARIOS LIBRES. Ofrécelos tal como están escritos, los dos en una sola frase, y pregunta cuál le sirve:",
    ...opciones.map((o, i) => `${i + 1}) ${o.dice}  [inicio para agendar: ${o.inicio}]`),
    "Nunca digas los corchetes ni la fecha en números.",
  ].join("\n");
}

async function agendar(args: DatosCita, c: Contexto): Promise<string> {
  const problema = problemaParaAgendar(args, c.transcripcion, c.zips);
  if (problema) return `NO SE AGENDÓ. ${problema}`;
  const inicio = new Date(args.inicio!);
  if (Number.isNaN(inicio.getTime()) || !dentroDelHorario(c.agenda, inicio, c.ahora)) {
    return "NO SE AGENDÓ. Ese horario no está dentro del horario de inspecciones: usa ver_horarios y ofrece una de las opciones que salgan.";
  }
  const fin = new Date(inicio.getTime() + c.agenda.duracionMin * 60000);
  const telefono = args.telefono && args.telefono.replace(/\D/g, "").length >= 10 ? args.telefono : c.telefono;
  const orden = ordenDeTrabajo(args, telefono);
  const r = await c.google("agendar", {
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
    titulo: orden.titulo,
    descripcion: orden.descripcion,
    ubicacion: orden.ubicacion,
    color: orden.color,
    avisar: true,
  });
  if (!r.ok) {
    if (/libre/i.test(String(r.error))) return "NO SE AGENDÓ: esa hora se acaba de ocupar. Discúlpate en una frase, usa ver_horarios otra vez y ofrece las nuevas opciones.";
    return "ERROR: no se pudo agendar. No confirmes ninguna cita ni le cuentes del error: dile que el equipo lo llama para confirmarle la hora y usa avisar_equipo (tipo llamar) con el horario que escogió.";
  }
  const dice = comoSeDice(inicio, c.ahora, c.agenda.zonaHoraria, idiomaDe((args as any).idioma));
  return `AGENDADA para ${dice}, en ${orden.ubicacion}. Ahora sí confírmasela: el día y la hora, la dirección, que es gratis, que dura de 30 a 60 minutos y que debe estar quien decide.`;
}

const ETIQUETAS: Record<string, string> = {
  urgente: "URGENTE",
  llamar: "Llamar de vuelta",
  horario_especial: "Pide un horario especial",
  otro: "Llamar de vuelta",
};

/** Cuándo poner el aviso en el calendario: en 15 minutos si es horario de trabajo, si no, a primera hora del siguiente día de inspecciones. */
function horaDelAviso(c: Contexto, urgente: boolean): Date {
  const pronto = new Date(c.ahora.getTime() + 15 * 60000);
  if (urgente) return pronto;
  const a = c.agenda;
  const [h0, m0] = a.desde.split(":").map(Number);
  const [h1, m1] = a.hasta.split(":").map(Number);
  const p = partesEn(pronto, a.zonaHoraria);
  const min = p.hora * 60 + p.minuto;
  if (a.dias.includes(p.diaSemana) && min >= h0 * 60 + m0 && min < h1 * 60 + m1) return pronto;
  for (let d = 0; d <= 8; d++) {
    const base = partesEn(new Date(enZona(p.anio, p.mes, p.dia, 12, 0, a.zonaHoraria).getTime() + d * 86400000), a.zonaHoraria);
    const candidato = enZona(base.anio, base.mes, base.dia, h0, m0 || 0, a.zonaHoraria);
    if (a.dias.includes(base.diaSemana) && candidato > c.ahora) return candidato;
  }
  return pronto;
}

async function avisar(args: any, c: Contexto): Promise<string> {
  const tipo = ETIQUETAS[String(args?.tipo)] ? String(args.tipo) : "otro";
  const etiqueta = ETIQUETAS[tipo];
  const nombre = String(args?.nombre || "Sin nombre").slice(0, 60);
  const telefono = args?.telefono && String(args.telefono).replace(/\D/g, "").length >= 10 ? String(args.telefono) : c.telefono;
  const necesita = String(args?.necesita ?? "").replace(/\s+/g, " ").slice(0, 500);
  const cuando = horaDelAviso(c, tipo === "urgente");
  const cuerpo = [
    `${etiqueta}: ${nombre}`,
    `Teléfono: ${telefono}`,
    `Qué necesita: ${necesita}`,
    `Llamó: ${isoEnZona(c.ahora, c.agenda.zonaHoraria).replace("T", " ").slice(0, 16)}`,
    "",
    "Aviso del agente de llamadas.",
  ].join("\n");
  const r = await c.google("aviso", {
    asunto: `${etiqueta} · ${nombre} · ${telefono}`,
    cuerpo,
    titulo: `${etiqueta} — ${nombre}`,
    inicio: cuando.toISOString(),
    fin: new Date(cuando.getTime() + 15 * 60000).toISOString(),
    color: tipo === "urgente" ? "11" : "5",
  });
  if (!r.ok) {
    return "ERROR: el aviso no le llegó al equipo. No le digas al cliente que avisaste ni que alguien lo va a llamar: dale el contacto del equipo para que llame o escriba.";
  }
  return "ENTREGADO: el equipo ya recibió el aviso. Díselo al cliente una sola vez, sin prometer una hora.";
}

export async function ejecutar(nombre: string, args: any, c: Contexto): Promise<string> {
  switch (nombre) {
    case "ver_horarios":
      return verHorarios(args, c);
    case "agendar_inspeccion":
      return agendar(args ?? {}, c);
    case "avisar_equipo":
      return avisar(args, c);
    default:
      return `ERROR: la herramienta ${nombre} no existe.`;
  }
}
