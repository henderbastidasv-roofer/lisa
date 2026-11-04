// Pruebas de la agenda y de las protecciones (gratis, sin internet): npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { AGENDA_EJEMPLO, comoSeDice, dentroDelHorario, dosOpciones, enZona, horariosLibres, isoEnZona } from "../lib/agenda.ts";
import { digitosDichos, ordenDeTrabajo, problemaParaAgendar, zipEnZona } from "../lib/reglas.ts";
import { ejecutar } from "../lib/herramientas.ts";

const Z = "America/Chicago";
// Miércoles 4 de noviembre de 2026, 3:00 p. m. en Houston (ya en horario de invierno, UTC-6).
const ahora = enZona(2026, 11, 4, 15, 0, Z);

test("la hora de Houston se convierte bien, también en horario de verano", () => {
  assert.equal(isoEnZona(enZona(2026, 11, 4, 15, 0, Z), Z), "2026-11-04T15:00:00-06:00");
  assert.equal(isoEnZona(enZona(2026, 7, 1, 9, 0, Z), Z), "2026-07-01T09:00:00-05:00");
});

test("no ofrece horarios dentro de la anticipación ni fuera del horario", () => {
  const libres = horariosLibres(AGENDA_EJEMPLO, [], ahora);
  // Con 2 horas de anticipación, hoy queda solo la de las 5 p. m. (termina a las 6).
  assert.equal(isoEnZona(libres[0], Z), "2026-11-04T17:00:00-06:00");
  assert.ok(libres.every((f) => dentroDelHorario(AGENDA_EJEMPLO, f, ahora)));
});

test("no ofrece domingos", () => {
  const libres = horariosLibres(AGENDA_EJEMPLO, [], ahora);
  assert.ok(!libres.some((f) => isoEnZona(f, Z).startsWith("2026-11-08")));
});

test("salta lo ocupado y da dos opciones distintas (mañana y tarde)", () => {
  const ocupado = [{ inicio: "2026-11-05T15:00:00Z", fin: "2026-11-05T17:00:00Z" }]; // 9 a 11 a. m. del jueves
  const op = dosOpciones({ ...AGENDA_EJEMPLO, anticipacionHoras: 18 }, ocupado, ahora, {}, "es");
  assert.equal(op.length, 2);
  assert.equal(op[0].inicio, "2026-11-05T11:00:00-06:00");
  assert.equal(op[1].inicio, "2026-11-05T12:00:00-06:00");
});

test("respeta si el cliente pide la tarde", () => {
  const op = dosOpciones({ ...AGENDA_EJEMPLO, anticipacionHoras: 24 }, [], ahora, { parte: "tarde" }, "es");
  assert.ok(op.every((o) => Number(o.inicio.slice(11, 13)) >= 12));
});

test("la fecha se dice en voz, en los dos idiomas", () => {
  const jueves = enZona(2026, 11, 5, 10, 0, Z);
  assert.equal(comoSeDice(jueves, ahora, Z, "es"), "mañana, jueves 5 de noviembre, a las 10 de la mañana");
  assert.equal(comoSeDice(jueves, ahora, Z, "en"), "tomorrow, Thursday, November 5, at 10 AM");
  assert.equal(comoSeDice(enZona(2026, 11, 6, 13, 0, Z), ahora, Z, "es"), "el viernes 6 de noviembre, a la una de la tarde");
});

test("entiende el ZIP dicho con palabras", () => {
  assert.equal(digitosDichos("Agent: ¿el ZIP?\nUser: siete siete cuatro dos nueve"), "77429");
  assert.equal(digitosDichos("User: seven seven oh oh eight"), "77008");
});

const completo = {
  inicio: "2026-11-05T11:00:00-06:00",
  nombre: "Rosa",
  direccion: "1234 Oak Hollow Drive",
  ciudad: "Cypress",
  zip: "77429",
  tipo_propiedad: "residencial",
  caso: "gotera",
  quien_decide: "ella y su esposo",
};

test("no agenda sin los datos del inspector", () => {
  const dicho = "User: es el 77429";
  assert.equal(problemaParaAgendar(completo, dicho, "770,774"), null);
  assert.match(problemaParaAgendar({ ...completo, zip: "7742" }, dicho)!, /código postal/);
  assert.match(problemaParaAgendar({ ...completo, quien_decide: "" }, dicho)!, /quién decide/);
  assert.match(problemaParaAgendar({ ...completo, caso: "tormenta" }, dicho)!, /reclamo/);
  assert.match(problemaParaAgendar(completo, "User: es en Cypress")!, /no dijo el ZIP/);
  assert.equal(problemaParaAgendar({ ...completo, zip_confirmado: true }, "User: es en Cypress"), null);
  assert.match(problemaParaAgendar({ ...completo, zip: "75201" }, "User: 75201", "770,774")!, /fuera de la zona/);
  assert.ok(zipEnZona("77429", ""));
});

test("la orden de trabajo lleva lo que necesita el inspector", () => {
  const o = ordenDeTrabajo({ ...completo, interes: "alto", resumen: "gotera en el cuarto" }, "+18325550123");
  assert.equal(o.titulo, "Inspección · Residencial · Gotera · Rosa · Cypress");
  assert.equal(o.ubicacion, "1234 Oak Hollow Drive, Cypress, 77429");
  assert.match(o.descripcion, /Teléfono: \+18325550123/);
  assert.equal(o.color, "11");
});

const contexto = (google: any) => ({
  telefono: "+18325550123",
  transcripcion: "User: 77429",
  ahora,
  agenda: { ...AGENDA_EJEMPLO, anticipacionHoras: 24 },
  zips: "",
  compania: "Techos Ejemplo LLC",
  google,
});

test("solo dice ENTREGADO si el aviso de verdad salió", async () => {
  const bien = await ejecutar("avisar_equipo", { tipo: "urgente", necesita: "agua en la sala" }, contexto(async () => ({ ok: true })));
  assert.match(bien, /^ENTREGADO/);
  const mal = await ejecutar("avisar_equipo", { tipo: "urgente", necesita: "agua" }, contexto(async () => ({ ok: false, error: "x" })));
  assert.match(mal, /^ERROR/);
  assert.doesNotMatch(mal, /ENTREGADO/);
});

test("solo dice AGENDADA si Google creó la cita", async () => {
  const bien = await ejecutar("agendar_inspeccion", completo, contexto(async () => ({ ok: true })));
  assert.match(bien, /^AGENDADA para mañana, jueves 5 de noviembre, a las 11 de la mañana/);
  const ocupada = await ejecutar("agendar_inspeccion", completo, contexto(async () => ({ ok: false, error: "esa hora ya no está libre" })));
  assert.match(ocupada, /^NO SE AGENDÓ/);
  const domingo = await ejecutar("agendar_inspeccion", { ...completo, inicio: "2026-11-08T10:00:00-06:00" }, contexto(async () => ({ ok: true })));
  assert.match(domingo, /^NO SE AGENDÓ/);
});

test("si no puede ver la agenda, no inventa horarios", async () => {
  const r = await ejecutar("ver_horarios", { idioma: "es" }, contexto(async () => ({ ok: false, error: "x" })));
  assert.match(r, /^ERROR/);
});
