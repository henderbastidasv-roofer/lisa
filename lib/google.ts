// Habla con el script de Google de la compañía (google/Lisa.gs), que tiene su calendario y su Gmail.
import { config } from "./config.js";

export type RespuestaGoogle = { ok: boolean; error?: string; [k: string]: unknown };

export async function google(accion: string, datos: Record<string, unknown> = {}): Promise<RespuestaGoogle> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), 20000);
  try {
    // Google contesta con una redirección: fetch la sigue sola (y la convierte en GET, que es lo correcto).
    const r = await fetch(config.googleUrl(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secreto: config.googleSecreto(), accion, ...datos }),
      redirect: "follow",
      signal: control.signal,
    });
    const texto = await r.text();
    try {
      return JSON.parse(texto) as RespuestaGoogle;
    } catch {
      return { ok: false, error: `Google respondió algo raro (${r.status}): ${texto.slice(0, 120)}` };
    }
  } catch (e) {
    return { ok: false, error: `no se pudo hablar con Google: ${(e as Error).message}` };
  } finally {
    clearTimeout(reloj);
  }
}
