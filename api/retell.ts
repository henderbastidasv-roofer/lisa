// Retell avisa aquí cuando termina cada llamada (evento call_analyzed, ya con el resumen).
// Regla de la casa: ningún cliente se queda sin atender. Si alguien llamó, habló y no quedó ni con cita,
// ni transferido, ni con un aviso que le llegó al equipo, aquí se deja el "Llamar de vuelta".
import { config } from "../lib/config.js";
import { google } from "../lib/google.js";
import { ejecutar } from "../lib/herramientas.js";
import { telefonoDe, vieneDeRetell } from "../lib/retell.js";

function quePaso(call: any) {
  const conHerramientas = JSON.stringify(call?.transcript_with_tool_calls ?? []);
  return {
    agendada: conHerramientas.includes("AGENDADA para"),
    avisada: conHerramientas.includes("ENTREGADO:"),
    transferida: call?.disconnection_reason === "call_transfer",
    hablo: /(^|\n)\s*User:\s*\S/.test(String(call?.transcript ?? "")),
  };
}

export async function POST(request: Request): Promise<Response> {
  const crudo = await request.text();
  if (!(await vieneDeRetell(crudo, request.headers.get("x-retell-signature")))) {
    return new Response("firma inválida", { status: 401 });
  }
  const { event, call } = JSON.parse(crudo);
  if (event !== "call_analyzed") return new Response(null, { status: 204 });

  const paso = quePaso(call);
  if (!paso.hablo) return new Response(null, { status: 204 }); // colgaron sin decir nada

  const telefono = telefonoDe(call);
  const analisis = call?.call_analysis ?? {};
  const datos = analisis.custom_analysis_data ?? {};
  const resumen = String(analisis.call_summary ?? "").trim() || "Retell no dejó resumen.";
  const nombre = String(datos.nombre || "Sin nombre");
  const minutos = call?.duration_ms ? Math.max(1, Math.round(call.duration_ms / 60000)) : null;

  if (paso.agendada) return new Response(null, { status: 204 }); // la orden de trabajo ya llegó por correo

  if (!paso.transferida && !paso.avisada) {
    // Red de seguridad: nadie quedó a cargo de este cliente durante la llamada.
    const r = await ejecutar(
      "avisar_equipo",
      { tipo: datos.urgente ? "urgente" : "llamar", nombre, telefono, necesita: resumen },
      { telefono, transcripcion: "", ahora: new Date(), agenda: config.agenda(), zips: config.zips(), compania: config.compania(), google },
    );
    console.log(`[${call?.call_id}] red de seguridad → ${r.slice(0, 80)}`);
    if (r.startsWith("ENTREGADO")) return new Response(null, { status: 204 });
    return new Response("no se pudo avisar", { status: 500 }); // Retell lo vuelve a intentar
  }

  const estado = paso.transferida ? "Se transfirió la llamada al equipo." : "El equipo ya recibió el aviso durante la llamada.";
  await google("resumen", {
    asunto: `Llamada de ${nombre} · ${telefono}`,
    cuerpo: [
      `Cliente: ${nombre}`,
      `Teléfono: ${telefono}`,
      minutos ? `Duración: ${minutos} min` : "",
      estado,
      "",
      resumen,
      "",
      call?.recording_url ? `Grabación: ${call.recording_url}` : "",
      `Llamada en Retell: ${call?.call_id}`,
    ]
      .filter((l) => l !== "")
      .join("\n"),
  });
  return new Response(null, { status: 204 });
}

export function GET(): Response {
  return new Response("Lisa: el aviso de llamadas está despierto.");
}
