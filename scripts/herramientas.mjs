// Las herramientas de Lisa, definidas una sola vez: el simulador y Retell usan estas mismas.

const texto = (description) => ({ type: "string", description });

export const HERRAMIENTAS = [
  {
    name: "ver_horarios",
    description:
      "Busca en el calendario dos horarios libres para la inspección. Úsala antes de ofrecer cualquier horario. Si el cliente pidió un día o la mañana o la tarde, pásalo.",
    mientras: "En una frase corta y natural, en el idioma de la llamada, di que revisas la agenda (por ejemplo: 'Dame un segundito, reviso la agenda').",
    parameters: {
      type: "object",
      properties: {
        idioma: { type: "string", enum: ["es", "en"], description: "Idioma de la llamada." },
        parte_del_dia: { type: "string", enum: ["manana", "tarde"], description: "Solo si el cliente pidió mañana o tarde." },
        dia: texto("Solo si el cliente pidió un día: AAAA-MM-DD."),
      },
      required: ["idioma"],
    },
  },
  {
    name: "agendar_inspeccion",
    description:
      "Agenda la inspección gratis en el calendario, cuando el cliente ya escogió una de las opciones de ver_horarios. Llena solo lo que el cliente dijo; nunca adivines un dato. Solo confirmas la cita si responde AGENDADA.",
    mientras: "En una frase corta, en el idioma de la llamada, di que la estás agendando.",
    parameters: {
      type: "object",
      properties: {
        inicio: texto("El 'inicio para agendar' de la opción que escogió, tal cual vino de ver_horarios."),
        idioma: { type: "string", enum: ["es", "en"], description: "Idioma de la llamada." },
        nombre: texto("Nombre del cliente."),
        apellido: texto("Apellido, si lo dijo."),
        telefono: texto("Solo si dio un número distinto al de la llamada."),
        correo: texto("Solo si lo dio."),
        direccion: texto("Calle y número de la propiedad."),
        ciudad: texto("Ciudad de la propiedad."),
        zip: texto("Código postal de 5 dígitos, tal como lo dijo el cliente."),
        zip_confirmado: { type: "boolean", description: "true solo si le leíste el ZIP y el cliente dijo que sí es." },
        tipo_propiedad: { type: "string", enum: ["residencial", "comercial"] },
        caso: { type: "string", enum: ["gotera", "tormenta", "reemplazo", "otro"] },
        resumen: texto("Qué le pasa al techo, en las palabras del cliente, en una o dos frases."),
        aseguranza: texto("Compañía de aseguranza si la dijo, 'no' o 'no sabe'."),
        reclamo: { type: "string", enum: ["si", "no", "no_sabe"], description: "Si ya abrió un reclamo." },
        fecha_tormenta: texto("Cuándo fue la tormenta y si fue granizo o viento."),
        material: texto("shingle, metal, teja, plano o no sabe."),
        edad_techo: texto("Años del techo, más o menos, o 'no sabe'."),
        quien_decide: texto("Quién decide sobre el techo y si va a estar."),
        como_nos_conocio: texto("Cómo conoció a la compañía, si lo dijo."),
        interes: { type: "string", enum: ["alto", "medio", "bajo"], description: "Qué tan interesado se ve." },
      },
      required: ["inicio", "nombre", "direccion", "zip", "tipo_propiedad", "caso", "quien_decide"],
    },
  },
  {
    name: "avisar_equipo",
    description:
      "Le manda un aviso al equipo (correo y calendario) para que llame a este cliente: emergencias, quien pide una persona o que lo llamen, un horario fuera de la agenda, casos que van a una persona, o cuando no se pudo agendar ni transferir. Una vez por necesidad. Solo si responde ENTREGADO le dices al cliente que el equipo ya sabe.",
    mientras: "Di solo algo corto y natural, como 'Un momentito'. No digas que estás avisando.",
    parameters: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["urgente", "llamar", "horario_especial", "otro"] },
        necesita: texto("Qué necesita el cliente, en una frase, con la dirección si la tienes."),
        nombre: texto("Nombre del cliente, si lo sabes."),
        telefono: texto("Solo si dio un número distinto al de la llamada."),
      },
      required: ["tipo", "necesita"],
    },
  },
];

export const TRANSFERIR = {
  name: "transferir_al_equipo",
  description:
    "Pasa la llamada en vivo a una persona del equipo: emergencias, quien pide una persona, referidos, clientes actuales, quejas, proveedores y temas legales.",
};

export const COLGAR = {
  name: "colgar",
  description: "Termina la llamada, solo cuando el cliente ya se despidió.",
};

/** Formato de Anthropic (simulador). */
export function paraAnthropic({ transferir }) {
  const vacio = { type: "object", properties: {} };
  return [
    ...HERRAMIENTAS.map((h) => ({ name: h.name, description: h.description, input_schema: h.parameters })),
    ...(transferir ? [{ ...TRANSFERIR, input_schema: vacio }] : []),
    { ...COLGAR, input_schema: vacio },
  ];
}

/** Formato de Retell (npm run agente). */
export function paraRetell({ url, telefonoTransferir, contacto }) {
  const herramientas = HERRAMIENTAS.map((h) => ({
    type: "custom",
    name: h.name,
    description: h.description,
    url: `${url}/api/herramientas`,
    method: "POST",
    parameters: h.parameters,
    speak_during_execution: true,
    speak_after_execution: true,
    execution_message_description: h.mientras,
    timeout_ms: 25000,
  }));
  if (telefonoTransferir) {
    herramientas.push({
      type: "transfer_call",
      name: TRANSFERIR.name,
      description: TRANSFERIR.description,
      transfer_destination: { type: "predefined", number: telefonoTransferir },
      // Transferencia cálida: la persona del equipo oye un resumen antes de tomar al cliente,
      // y si no contesta en 25 segundos, el cliente vuelve con Lisa (no cae en un buzón).
      transfer_option: {
        type: "warm_transfer",
        show_transferee_as_caller: false,
        on_hold_music: "ringtone",
        transfer_ring_duration_ms: 25000,
        private_handoff_option: {
          type: "prompt",
          prompt: "Le hablas a una persona del equipo antes de pasarle la llamada. En español, en una o dos frases cortas: quién llama, qué necesita y la dirección si la tienes. Luego di que lo conectas.",
        },
      },
      speak_during_execution: true,
      execution_message_description: `En una frase corta, en el idioma de la llamada, di que lo comunicas con ${contacto} y que espere un momento.`,
    });
  }
  herramientas.push({ type: "end_call", name: COLGAR.name, description: COLGAR.description });
  return herramientas;
}
