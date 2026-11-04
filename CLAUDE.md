# Lisa

Agente de llamadas para compañías de techos, de Rufero Pro y ConstruIA. Contesta el teléfono, ve la agenda, agenda inspecciones y le deja avisos al equipo.

- **Si estás instalando a Lisa, sigue `INSTALAR.md` paso a paso.** La persona con la que hablas no sabe programar: háblale simple, en su idioma, una cosa a la vez.
- **Nunca le pidas claves en el chat.** Se escriben solo en la Terminal con `npm run claves`.
- **Retell cobra cada minuto, también los de prueba.** Antes de una llamada de prueba, de comprar un número o de correr `npm run pruebas`, dile cuánto cuesta y espera su sí. `npm test` es gratis.
- `negocio/`, `conocimiento/privado/` y `google/Lisa-listo.gs` son de la compañía: **nunca se suben a GitHub** (ya están en `.gitignore`). No hagas `git push` desde esta carpeta.
- Cambiar lo que sabe Lisa: editar `negocio/*.md` o `conocimiento/`, y correr `npm run agente`. No hace falta volver a publicar.
- Cambiar el código (`api/`, `lib/`): `npm test`, `npm run typecheck` y después `npm run publicar`.

## Cómo está hecha
- **Retell** pone la voz, el oído, el cerebro (Claude Haiku 4.5, temperatura 0.15) y el número. El guion vive en Retell: `npm run agente` lo arma (`scripts/armar-prompt.mjs`) y publica una versión nueva. Los números apuntan a `latest_published`.
- **Vercel** tiene dos funciones:
  - `api/herramientas.ts`: Retell la llama en medio de la llamada (`ver_horarios`, `agendar_inspeccion`, `avisar_equipo`). Revisa la firma `X-Retell-Signature`.
  - `api/retell.ts`: el aviso de fin de llamada (`call_analyzed`). Si alguien habló y no quedó ni con cita, ni transferido, ni con aviso entregado, deja un "Llamar de vuelta". Si no, manda el resumen por correo.
  - `api/salud.ts`: para ver si está despierta.
- **Google Apps Script** (`google/Lisa.gs`, en la cuenta de la compañía): lee lo ocupado, crea la cita y manda los correos. Sin Google Cloud ni base de datos.
- `lib/herramientas.ts` es lo que hace cada herramienta. Lo usan las llamadas reales y el simulador, así las pruebas revisan el mismo código.
- `lib/reglas.ts`: las protecciones, que no dependen de que la IA obedezca. No agenda sin ZIP dicho por el cliente, sin quién decide, fuera de la zona, ni un caso de tormenta sin preguntar por el reclamo.
- `lib/agenda.ts`: los horarios libres y cómo se dicen en voz ("mañana, jueves 5 de noviembre, a las 10 de la mañana"), para que la IA nunca calcule fechas.

## Reglas que salieron de Bobby y de Sofía
- **Ningún cliente se queda sin atender:** cada llamada termina en cita, transferencia o aviso entregado; si no, la red de seguridad de `api/retell.ts` deja el aviso.
- **No da precios ni diagnostica.** Solo un precio fijo si está escrito en `negocio/compania.md`.
- **Lo de adentro no se le cuenta al cliente:** primero avisa, y solo si `avisar_equipo` responde ENTREGADO le dice que el equipo ya sabe. Si falla, le da el contacto. Nunca habla de herramientas, sistemas ni errores.
- **Solo confirma una cita si `agendar_inspeccion` respondió AGENDADA.**
