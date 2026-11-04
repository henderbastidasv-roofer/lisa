/**
 * Lisa: el puente con tu Google Calendar y tu Gmail.
 *
 * No edites este archivo a mano: `npm run google` crea una copia lista (google/Lisa-listo.gs)
 * con tu clave secreta y tus correos, y la copia al portapapeles para que la pegues en script.google.com.
 *
 * Qué hace (solo con tu cuenta de Google, sin Google Cloud):
 *   ocupado  → lee los eventos de tu calendario para saber qué horas están tomadas
 *   agendar  → crea la inspección en el calendario (revisa antes que la hora siga libre)
 *   aviso    → manda un correo al equipo y deja un evento "Llamar de vuelta" o "URGENTE"
 *   resumen  → manda por correo el resumen de una llamada
 *   salud    → para revisar que todo esté conectado
 */

const SECRETO = "__SECRETO__";
const CORREOS = "__CORREOS__"; // separados por coma
const CALENDARIO = "__CALENDARIO__"; // "primary" = el calendario principal de esta cuenta

// PRIMERO: deja escogida esta función arriba, junto a ▶ Ejecutar (Run), y tócalo una vez para dar los permisos.
// Está de primera para que Google la escoja sola. No ejecutes doPost: esa la usa Lisa desde internet.
function darPermisos() {
  Logger.log("Calendario: " + calendario_().getName());
  Logger.log("Correos que quedan hoy: " + MailApp.getRemainingDailyQuota());
}

function calendario_() {
  return CALENDARIO === "primary" ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(CALENDARIO);
}

function responder_(datos) {
  return ContentService.createTextOutput(JSON.stringify(datos)).setMimeType(ContentService.MimeType.JSON);
}

// Los eventos marcados como "Disponible" no bloquean la agenda; los "Ocupado", sí.
function estaLibre_(evento) {
  try {
    return String(evento.getTransparency()) === "TRANSPARENT";
  } catch (e) {
    return false;
  }
}

function ocupado_(desde, hasta) {
  return calendario_()
    .getEvents(new Date(desde), new Date(hasta))
    .filter(function (e) { return !estaLibre_(e); })
    .map(function (e) {
      return { inicio: e.getStartTime().toISOString(), fin: e.getEndTime().toISOString() };
    });
}

function crearEvento_(p) {
  const cal = calendario_();
  const evento = cal.createEvent(p.titulo, new Date(p.inicio), new Date(p.fin), {
    description: p.descripcion || "",
    location: p.ubicacion || "",
  });
  if (p.color) evento.setColor(String(p.color));
  if (p.libre) {
    try { evento.setTransparency(CalendarApp.EventTransparency.TRANSPARENT); } catch (e) {}
  }
  return evento.getId();
}

function correo_(asunto, cuerpo) {
  const para = CORREOS.split(",").map(function (c) { return c.trim(); }).filter(String);
  if (!para.length) throw new Error("no hay correos del equipo");
  MailApp.sendEmail({ to: para.join(","), subject: asunto, body: cuerpo });
  return para;
}

function doPost(e) {
  let p;
  try {
    p = JSON.parse(e.postData.contents);
  } catch (err) {
    return responder_({ ok: false, error: "pedido inválido" });
  }
  if (p.secreto !== SECRETO) return responder_({ ok: false, error: "clave incorrecta" });

  // Un solo pedido a la vez: así dos llamadas no agarran la misma hora.
  const candado = LockService.getScriptLock();
  candado.waitLock(20000);
  try {
    switch (p.accion) {
      case "salud":
        return responder_({
          ok: true,
          calendario: calendario_().getName(),
          correosHoy: MailApp.getRemainingDailyQuota(),
        });
      case "ocupado":
        return responder_({ ok: true, ocupado: ocupado_(p.desde, p.hasta) });
      case "agendar": {
        if (ocupado_(p.inicio, p.fin).length) return responder_({ ok: false, error: "esa hora ya no está libre" });
        const id = crearEvento_(p);
        let avisado = [];
        if (p.avisar) {
          try { avisado = correo_(p.titulo, p.descripcion); } catch (err) {}
        }
        return responder_({ ok: true, id: id, avisado: avisado });
      }
      case "aviso": {
        // Primero el correo: si no sale, no hay aviso y Lisa no le dice al cliente que avisó.
        const para = correo_(p.asunto, p.cuerpo);
        let id = "";
        try {
          id = crearEvento_({ titulo: p.titulo, inicio: p.inicio, fin: p.fin, descripcion: p.cuerpo, color: p.color, libre: true });
        } catch (err) {}
        return responder_({ ok: true, para: para, evento: id });
      }
      case "resumen":
        return responder_({ ok: true, para: correo_(p.asunto, p.cuerpo) });
      default:
        return responder_({ ok: false, error: "acción desconocida" });
    }
  } catch (err) {
    return responder_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    candado.releaseLock();
  }
}

// Si abres el link en el navegador, te dice que está despierto (sin mostrar nada de tu calendario).
function doGet() {
  return ContentService.createTextOutput("Lisa: el puente con Google está despierto.");
}
