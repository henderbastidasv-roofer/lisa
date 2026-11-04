// La agenda de Lisa: calcula los horarios libres a partir de lo ocupado en el calendario.
// No sabe nada de Google ni de Retell: recibe lo ocupado y devuelve opciones con la fecha dicha en voz.
// Lo usan api/herramientas.ts (en vivo) y scripts/simular.mjs (en pruebas), para que las dos hagan lo mismo.

export type Agenda = {
  zonaHoraria: string; // America/Chicago
  dias: number[]; // días con inspecciones, 1 = lunes ... 7 = domingo
  desde: string; // "09:00": primera inspección
  hasta: string; // "18:00": la inspección tiene que terminar a esta hora
  duracionMin: number; // cuánto se aparta por inspección
  anticipacionHoras: number; // no ofrece nada que empiece antes de esto
  diasAdelante: number; // hasta cuántos días busca
};

export type Ocupado = { inicio: string; fin: string };
export type Opcion = { inicio: string; fin: string; dice: string };

export const AGENDA_EJEMPLO: Agenda = {
  zonaHoraria: "America/Chicago",
  dias: [1, 2, 3, 4, 5, 6],
  desde: "09:00",
  hasta: "18:00",
  duracionMin: 60,
  anticipacionHoras: 2,
  diasAdelante: 10,
};

/** Lee la agenda de la variable LISA_AGENDA (JSON) o usa la de ejemplo. */
export function agendaDe(texto: string | undefined): Agenda {
  if (!texto) return AGENDA_EJEMPLO;
  return { ...AGENDA_EJEMPLO, ...JSON.parse(texto) };
}

// ---------- fechas en la zona horaria de la compañía, sin librerías ----------

type Partes = { anio: number; mes: number; dia: number; hora: number; minuto: number; diaSemana: number };

const SEMANA: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function partesEn(fecha: Date, zona: string): Partes {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(fecha).map((x) => [x.type, x.value]));
  return {
    anio: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour) % 24,
    minuto: Number(p.minute),
    diaSemana: SEMANA[p.weekday] ?? 0,
  };
}

/** La hora de pared (año, mes, día, hora, minuto) en `zona`, como instante real. */
export function enZona(anio: number, mes: number, dia: number, hora: number, minuto: number, zona: string): Date {
  const deseado = Date.UTC(anio, mes - 1, dia, hora, minuto);
  let t = deseado;
  // Dos vueltas bastan, también en los cambios de horario.
  for (let i = 0; i < 2; i++) {
    const p = partesEn(new Date(t), zona);
    const visto = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto);
    t += deseado - visto;
  }
  return new Date(t);
}

/** "2026-11-05T10:00:00-06:00": con el desfase de la zona, para que se lea bien en el calendario. */
export function isoEnZona(fecha: Date, zona: string): string {
  const p = partesEn(fecha, zona);
  const comoUtc = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto);
  const desfase = Math.round((comoUtc - Math.floor(fecha.getTime() / 60000) * 60000) / 60000);
  const signo = desfase >= 0 ? "+" : "-";
  const a = Math.abs(desfase);
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${p.anio}-${dos(p.mes)}-${dos(p.dia)}T${dos(p.hora)}:${dos(p.minuto)}:00${signo}${dos(Math.floor(a / 60))}:${dos(a % 60)}`;
}

// ---------- cómo se dice la fecha en voz ----------

const DIAS_ES = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const DIAS_EN = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MESES_ES = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_EN = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function diasEntre(a: Partes, b: Partes): number {
  return Math.round((Date.UTC(b.anio, b.mes - 1, b.dia) - Date.UTC(a.anio, a.mes - 1, a.dia)) / 86400000);
}

function horaEs(h: number, m: number): string {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const min = m ? ` y ${m}` : "";
  const parte = h < 12 ? "de la mañana" : h < 19 ? "de la tarde" : "de la noche";
  return `${h12 === 1 ? "la una" : `las ${h12}`}${min} ${parte}`;
}

function horaEn(h: number, m: number): string {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

/** "mañana, jueves 6 de noviembre, a las 10 de la mañana" · "tomorrow, Thursday, November 6, at 10 AM". */
export function comoSeDice(fecha: Date, ahora: Date, zona: string, idioma: "es" | "en"): string {
  const p = partesEn(fecha, zona);
  const hoy = partesEn(ahora, zona);
  const d = diasEntre(hoy, p);
  if (idioma === "en") {
    const cuando = d === 0 ? "today, " : d === 1 ? "tomorrow, " : "";
    return `${cuando}${DIAS_EN[p.diaSemana]}, ${MESES_EN[p.mes]} ${p.dia}, at ${horaEn(p.hora, p.minuto)}`;
  }
  const cuando = d === 0 ? "hoy, " : d === 1 ? "mañana, " : "el ";
  return `${cuando}${DIAS_ES[p.diaSemana]} ${p.dia} de ${MESES_ES[p.mes]}, a ${horaEs(p.hora, p.minuto)}`;
}

// ---------- horarios libres ----------

function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Todos los horarios libres, en orden, dentro de los próximos días de la agenda. */
export function horariosLibres(agenda: Agenda, ocupado: Ocupado[], ahora: Date): Date[] {
  const zona = agenda.zonaHoraria;
  const dur = agenda.duracionMin * 60000;
  const minimo = ahora.getTime() + agenda.anticipacionHoras * 3600000;
  const bloques = ocupado.map((o) => [new Date(o.inicio).getTime(), new Date(o.fin).getTime()] as const);
  const hoy = partesEn(ahora, zona);
  const libres: Date[] = [];
  for (let d = 0; d <= agenda.diasAdelante; d++) {
    // Mediodía para movernos de día sin tropezar con los cambios de horario.
    const base = partesEn(new Date(enZona(hoy.anio, hoy.mes, hoy.dia, 12, 0, zona).getTime() + d * 86400000), zona);
    if (!agenda.dias.includes(base.diaSemana)) continue;
    for (let m = minutos(agenda.desde); m + agenda.duracionMin <= minutos(agenda.hasta); m += agenda.duracionMin) {
      const inicio = enZona(base.anio, base.mes, base.dia, Math.floor(m / 60), m % 60, zona);
      const a = inicio.getTime();
      const b = a + dur;
      if (a < minimo) continue;
      if (bloques.some(([x, y]) => x < b && y > a)) continue;
      libres.push(inicio);
    }
  }
  return libres;
}

export type Preferencia = { parte?: "manana" | "tarde"; dia?: string };

/**
 * Dos opciones distintas, como pide el playbook: mañana y tarde, o días distintos.
 * `dia` es "AAAA-MM-DD" si el cliente pidió un día; `parte`, si pidió mañana o tarde.
 */
export function dosOpciones(agenda: Agenda, ocupado: Ocupado[], ahora: Date, pref: Preferencia, idioma: "es" | "en"): Opcion[] {
  const zona = agenda.zonaHoraria;
  let libres = horariosLibres(agenda, ocupado, ahora);
  if (pref.dia) {
    const delDia = libres.filter((f) => isoEnZona(f, zona).startsWith(pref.dia!));
    if (delDia.length) libres = delDia;
  }
  if (pref.parte) {
    const deEsaParte = libres.filter((f) => (partesEn(f, zona).hora < 12) === (pref.parte === "manana"));
    if (deEsaParte.length) libres = deEsaParte;
  }
  const elegidas: Date[] = [];
  const primera = libres[0];
  if (primera) {
    elegidas.push(primera);
    const p1 = partesEn(primera, zona);
    const distinta =
      libres.find((f) => {
        const p = partesEn(f, zona);
        return p.dia === p1.dia && (p.hora < 12) !== (p1.hora < 12);
      }) ??
      libres.find((f) => partesEn(f, zona).dia !== p1.dia) ??
      libres[1];
    if (distinta) elegidas.push(distinta);
  }
  return elegidas
    .sort((a, b) => a.getTime() - b.getTime())
    .map((f) => ({
      inicio: isoEnZona(f, zona),
      fin: isoEnZona(new Date(f.getTime() + agenda.duracionMin * 60000), zona),
      dice: comoSeDice(f, ahora, zona, idioma),
    }));
}

/** ¿Este inicio cae dentro del horario de inspecciones y en el futuro? */
export function dentroDelHorario(agenda: Agenda, inicio: Date, ahora: Date): boolean {
  const p = partesEn(inicio, agenda.zonaHoraria);
  const m = p.hora * 60 + p.minuto;
  return (
    inicio.getTime() > ahora.getTime() &&
    agenda.dias.includes(p.diaSemana) &&
    m >= minutos(agenda.desde) &&
    m + agenda.duracionMin <= minutos(agenda.hasta)
  );
}
