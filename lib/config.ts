// Variables de entorno que usa Lisa en Vercel. Las sube scripts/publicar.mjs.
import { agendaDe, type Agenda } from "./agenda.js";

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
  return valor;
}

export const config = {
  retellKey: () => requerida("RETELL_API_KEY"),
  googleUrl: () => requerida("GOOGLE_SCRIPT_URL"),
  googleSecreto: () => requerida("LISA_SECRETO_GOOGLE"),
  agenda: (): Agenda => agendaDe(process.env.LISA_AGENDA),
  zips: () => process.env.LISA_ZIPS ?? "",
  compania: () => process.env.LISA_COMPANIA || "la compañía",
  nombreAgente: () => process.env.LISA_NOMBRE || "Lisa",
};
