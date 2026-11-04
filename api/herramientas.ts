// Retell llama aquí cuando Lisa usa una herramienta en medio de la llamada:
// ver_horarios, agendar_inspeccion y avisar_equipo.
import { config } from "../lib/config.js";
import { google } from "../lib/google.js";
import { ejecutar } from "../lib/herramientas.js";
import { telefonoDe, vieneDeRetell } from "../lib/retell.js";

export async function POST(request: Request): Promise<Response> {
  const crudo = await request.text();
  if (!(await vieneDeRetell(crudo, request.headers.get("x-retell-signature")))) {
    return new Response("firma inválida", { status: 401 });
  }
  let pedido: any;
  try {
    pedido = JSON.parse(crudo);
  } catch {
    return new Response("pedido inválido", { status: 400 });
  }
  const nombre = String(pedido?.name ?? "");
  try {
    const resultado = await ejecutar(nombre, pedido?.args ?? {}, {
      telefono: telefonoDe(pedido?.call),
      transcripcion: String(pedido?.call?.transcript ?? ""),
      ahora: new Date(),
      agenda: config.agenda(),
      zips: config.zips(),
      compania: config.compania(),
      google,
    });
    console.log(`[${pedido?.call?.call_id ?? "?"}] ${nombre} → ${resultado.split("\n")[0].slice(0, 120)}`);
    return Response.json({ resultado });
  } catch (e) {
    console.error(`[${pedido?.call?.call_id ?? "?"}] ${nombre} falló:`, e);
    // Lisa nunca se queda muda: le decimos qué hacer aunque algo se rompa.
    return Response.json({
      resultado:
        "ERROR: la herramienta falló. No le cuentes al cliente del error ni confirmes nada: dale el contacto del equipo y sigue atendiéndolo.",
    });
  }
}

export function GET(): Response {
  return new Response("Lisa: las herramientas están despiertas.");
}
