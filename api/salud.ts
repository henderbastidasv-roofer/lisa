// Abre <dirección de Lisa>/api/salud en el navegador para ver si Lisa está despierta y conectada con Google.
import { google } from "../lib/google.js";

export async function GET(): Promise<Response> {
  const faltan = ["RETELL_API_KEY", "GOOGLE_SCRIPT_URL", "LISA_SECRETO_GOOGLE"].filter((n) => !process.env[n]);
  if (faltan.length) return new Response(`Lisa está despierta, pero faltan claves: ${faltan.join(", ")}`, { status: 500 });
  const g = await google("salud");
  if (!g.ok) return new Response(`Lisa está despierta, pero no habla con Google: ${g.error}`, { status: 500 });
  return new Response("Lisa está despierta y conectada con Google.");
}
