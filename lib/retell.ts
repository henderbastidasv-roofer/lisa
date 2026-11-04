// Revisa que un pedido venga de verdad de Retell (firma X-Retell-Signature con tu clave de Retell).
import Retell from "retell-sdk";
import { config } from "./config.js";

export async function vieneDeRetell(crudo: string, firma: string | null): Promise<boolean> {
  if (!firma) return false;
  try {
    return Boolean(await Retell.verify(crudo, config.retellKey(), firma));
  } catch {
    return false;
  }
}

/** El número del cliente, o una etiqueta si es una llamada de prueba desde el navegador. */
export function telefonoDe(call: any): string {
  if (call?.from_number) return String(call.from_number);
  return call?.call_type === "web_call" ? "llamada de prueba (web)" : "sin número";
}
