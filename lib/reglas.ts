// Las protecciones de Lisa: no dependen de que la IA obedezca.
// Antes de agendar, el código revisa que estén los datos que necesita el inspector y que el ZIP
// lo haya dicho el cliente. Si algo falta, le devuelve a Lisa qué preguntar, y no agenda.

export type DatosCita = {
  inicio?: string;
  nombre?: string;
  apellido?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  zip?: string;
  zip_confirmado?: boolean;
  tipo_propiedad?: string; // residencial | comercial
  caso?: string; // gotera | tormenta | reemplazo | otro
  resumen?: string;
  aseguranza?: string; // compañía, o "no", o "no sabe"
  reclamo?: string; // si | no | no_sabe
  fecha_tormenta?: string;
  material?: string;
  edad_techo?: string;
  quien_decide?: string;
  como_nos_conocio?: string;
  correo?: string;
  interes?: string; // alto | medio | bajo
};

const NUMEROS: Record<string, string> = {
  cero: "0", zero: "0", oh: "0",
  uno: "1", una: "1", one: "1",
  dos: "2", two: "2",
  tres: "3", three: "3",
  cuatro: "4", four: "4",
  cinco: "5", five: "5",
  seis: "6", six: "6",
  siete: "7", seven: "7",
  ocho: "8", eight: "8",
  nueve: "9", nine: "9",
};

/** Lo que dijo el cliente, solo con dígitos: "siete siete cuatro dos nueve" → "77429". */
export function digitosDichos(transcripcion: string): string {
  const delCliente = transcripcion
    .split(/\r?\n/)
    .filter((l) => /^\s*(user|cliente)\s*:/i.test(l))
    .join(" ");
  return delCliente
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .map((p) => (/^\d+$/.test(p) ? p : NUMEROS[p] ?? " "))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export function zipDicho(zip: string, transcripcion: string): boolean {
  return digitosDichos(transcripcion).replace(/ /g, "").includes(zip);
}

/** Prefijos de ZIP de la zona, por ejemplo "770,771,772". Vacío = no se revisa. */
export function zipEnZona(zip: string, prefijos: string | undefined): boolean {
  const lista = (prefijos ?? "").split(/[,\s]+/).map((p) => p.trim()).filter(Boolean);
  return !lista.length || lista.some((p) => zip.startsWith(p));
}

const vacio = (v?: string) => !v || !v.trim() || /^(unknown|desconocido|pendiente|n\/a|none|null)$/i.test(v.trim());

/** Devuelve el problema (lo que Lisa tiene que hacer) o null si se puede agendar. */
export function problemaParaAgendar(d: DatosCita, transcripcion: string, zipsZona?: string): string | null {
  if (vacio(d.inicio)) return "Falta el horario: usa ver_horarios y ofrece dos opciones.";
  if (vacio(d.nombre)) return "Falta el nombre del cliente: pregúntaselo.";
  if (vacio(d.direccion)) return "Falta la dirección de la propiedad: pídesela.";
  const zip = (d.zip ?? "").replace(/\D/g, "");
  if (zip.length !== 5) return "Falta el código postal (ZIP) de 5 dígitos: pídeselo al cliente. Nunca lo completes tú.";
  if (!zipEnZona(zip, zipsZona))
    return "Ese ZIP está fuera de la zona de servicio: no agendes. Explícale con amabilidad que no llegan a su zona; si hay duda, usa avisar_equipo.";
  if (!d.zip_confirmado && !zipDicho(zip, transcripcion))
    return `El cliente no dijo el ZIP ${zip} en la llamada. Léele la dirección con el ZIP y pídele que te lo confirme. Si lo confirma, vuelve a usar agendar_inspeccion con zip_confirmado: true.`;
  if (vacio(d.tipo_propiedad)) return "Falta saber si es casa (residencial) o propiedad comercial: pregúntaselo.";
  if (vacio(d.caso)) return "Falta el caso (gotera, tormenta, reemplazo u otro).";
  if (vacio(d.quien_decide)) return "Falta saber quién decide sobre el techo y que esté en la inspección: pregúntaselo.";
  if (/tormenta|storm|granizo|hail|viento|wind|aseguranza|insurance/i.test(d.caso ?? "") && vacio(d.reclamo))
    return "Es un caso de tormenta: pregúntale si ya abrió un reclamo con su aseguranza antes de agendar.";
  return null;
}

const COLORES: Record<string, string> = { alto: "11", medio: "5", bajo: "9" }; // rojo, amarillo, azul (Google Calendar)

/** La orden de trabajo que ve el inspector en el calendario. */
export function ordenDeTrabajo(d: DatosCita, telefono: string) {
  const tipo = /comer/i.test(d.tipo_propiedad ?? "") ? "Comercial" : "Residencial";
  const caso = (d.caso ?? "").replace(/^\w/, (c) => c.toUpperCase());
  const nombre = [d.nombre, d.apellido].filter((x) => !vacio(x)).join(" ");
  const ciudad = vacio(d.ciudad) ? "" : d.ciudad!.trim();
  const titulo = ["Inspección", tipo, caso, nombre, ciudad].filter(Boolean).join(" · ");
  const zip = (d.zip ?? "").replace(/\D/g, "");
  const direccion = d.direccion!.trim();
  const ubicacion = [direccion, ciudad && !direccion.toLowerCase().includes(ciudad.toLowerCase()) ? ciudad : "", direccion.includes(zip) ? "" : zip]
    .filter(Boolean)
    .join(", ");
  const linea = (etiqueta: string, v?: string) => (vacio(v) ? null : `${etiqueta}: ${v!.trim()}`);
  const descripcion = [
    linea("Cliente", nombre),
    linea("Teléfono", telefono),
    linea("Correo", d.correo),
    linea("Dirección", ubicacion),
    linea("Propiedad", tipo),
    linea("Caso", caso),
    linea("Lo que contó", d.resumen),
    linea("Aseguranza", d.aseguranza),
    linea("Reclamo abierto", d.reclamo),
    linea("Tormenta", d.fecha_tormenta),
    linea("Techo", [d.material, d.edad_techo ? `${d.edad_techo} años` : ""].filter((x) => !vacio(x)).join(", ")),
    linea("Quién decide", d.quien_decide),
    linea("Cómo nos conoció", d.como_nos_conocio),
    "",
    "Agendada por el agente de llamadas.",
  ]
    .filter((x) => x !== null)
    .join("\n");
  return { titulo, ubicacion, descripcion, color: COLORES[(d.interes ?? "").toLowerCase()] ?? "" };
}
