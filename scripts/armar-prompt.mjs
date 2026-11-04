// Arma lo que sabe Lisa: instrucciones + datos de la compañía + biblioteca técnica.
// Lo usan el simulador (npm run simular) y el que sube el agente a Retell (npm run agente).
import fs from "node:fs";
import path from "node:path";
import { RAIZ } from "./_util.mjs";

export const DATOS_PROPIOS = path.join(RAIZ, "negocio", "datos.json");
export const DATOS_EJEMPLO = path.join(RAIZ, "pruebas", "negocio-ejemplo.json");

/** negocio/datos.json si ya se hizo la entrevista; si no, Techos Ejemplo LLC. */
export function rutaDatos() {
  return fs.existsSync(DATOS_PROPIOS) ? DATOS_PROPIOS : DATOS_EJEMPLO;
}

export function leerDatos(archivo = rutaDatos()) {
  if (!fs.existsSync(archivo)) {
    throw new Error(`No existe ${path.relative(RAIZ, archivo)}. Claude Code lo crea en la entrevista (INSTALAR.md, fase 1).`);
  }
  return JSON.parse(fs.readFileSync(archivo, "utf8"));
}

export const esEjemplo = (archivo) => path.basename(archivo) === "negocio-ejemplo.json";

/** La agenda que usa el código (lib/agenda.ts), sacada de los datos de la entrevista. */
export function agendaDeDatos(d) {
  return {
    zonaHoraria: d.ZONA_HORARIA || "America/Chicago",
    dias: String(d.AGENDA_DIAS || "1,2,3,4,5,6").split(",").map((x) => Number(x.trim())).filter(Boolean),
    desde: d.AGENDA_DESDE || "09:00",
    hasta: d.AGENDA_HASTA || "18:00",
    duracionMin: Number(d.AGENDA_DURACION || 60),
    anticipacionHoras: Number(d.AGENDA_ANTICIPACION || 2),
    diasAdelante: Number(d.AGENDA_DIAS_ADELANTE || 10),
  };
}

/** Lo primero que dice Lisa al contestar. */
export function saludo(d) {
  return String(d.IDIOMA_SALUDO || "es").startsWith("en")
    ? `Hi, thank you for calling ${d.COMPANIA}, this is ${d.NOMBRE_AGENTE}. How can I help you today?`
    : `Gracias por llamar a ${d.COMPANIA}, te atiende ${d.NOMBRE_AGENTE}. ¿En qué te puedo ayudar?`;
}

function leerCarpeta(carpeta, { excluir = [] } = {}) {
  const dir = path.join(RAIZ, carpeta);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !excluir.includes(f))
    .sort()
    .map((f) => fs.readFileSync(path.join(dir, f), "utf8").trim());
}

const TRANSFERIR = `# Pasar la llamada
Tienes la herramienta transferir_al_equipo, que pasa la llamada en vivo a {{CONTACTO_HUMANO}}.
- Úsala en emergencias y en los casos de "Cuándo va a una persona". Antes, si no lo tienes, pide el nombre.
- Dile en una frase que lo comunicas con el equipo y que espere un momento. Nada más.
- Si la transferencia no entra (nadie contesta), no se lo cuentes como un error: dile que el equipo no pudo tomar la llamada en este momento, usa avisar_equipo y sigue con las reglas de los avisos.`;

const SIN_TRANSFERIR = `# Pasar la llamada
No puedes pasar la llamada en vivo. Cuando un caso va a una persona, usas avisar_equipo y le das el contacto del equipo: {{CONTACTO_HUMANO}}.`;

export function armarPrompt(archivo = rutaDatos()) {
  const datos = leerDatos(archivo);
  const base = fs.readFileSync(path.join(RAIZ, "lisa", "prompt-base.md"), "utf8").replace(/<!--[\s\S]*?-->/g, "").trim();
  const negocio = esEjemplo(archivo)
    ? [fs.readFileSync(path.join(RAIZ, "pruebas", "compania-ejemplo.md"), "utf8").trim()]
    : leerCarpeta("negocio", { excluir: ["plantilla.md"] });
  const biblioteca = [...leerCarpeta("conocimiento"), ...leerCarpeta("conocimiento/privado", { excluir: ["LEEME.md"] })];

  const partes = [base, datos.TELEFONO_TRANSFERIR ? TRANSFERIR : SIN_TRANSFERIR];
  if (negocio.length) partes.push("# Tu compañía\n\n" + negocio.join("\n\n"));
  if (biblioteca.length) partes.push("# Biblioteca técnica\n\n" + biblioteca.join("\n\n"));

  // Solo las variables en MAYÚSCULA son nuestras; las de Retell van en minúscula ({{current_time}}).
  const prompt = partes
    .join("\n\n---\n\n")
    .replace(/\{\{([A-Z_]+)\}\}/g, (todo, clave) => (datos[clave] !== undefined && datos[clave] !== "" ? String(datos[clave]) : todo));
  const sinLlenar = [...new Set(prompt.match(/\{\{[A-Z_]+\}\}/g) ?? [])];
  if (sinLlenar.length) throw new Error(`Faltan estos datos en ${path.basename(archivo)}: ${sinLlenar.join(", ")}`);
  return prompt;
}
