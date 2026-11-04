# Instalar a Lisa: guía para Claude Code

Esta guía la sigue **Claude Code**, no la persona. La persona es dueña o trabaja en una compañía de techos y **no sabe programar**. Tu trabajo es llevarla de la mano hasta que Lisa conteste el teléfono de su compañía.

## Cómo trabajas con la persona
- **Háblale en español** (o en inglés si te escribe en inglés), con palabras simples. Nada de jerga de programación. Si tienes que usar una palabra técnica, explícala en una línea.
- **Una cosa a la vez.** Dale un paso, espera a que te diga que lo hizo y sigue. No le sueltes listas de 10 pasos.
- **Tú corres los comandos.** La persona solo abre páginas, se registra, hace clic y escribe sus claves cuando un script se las pide.
- **Las claves nunca se pegan en el chat.** Si la persona pega una clave en el chat, dile que la borre y que la cree de nuevo en esa página, porque ya quedó expuesta. Las claves solo se escriben en la Terminal, cuando `npm run claves` las pide (se ven como ****).
- **Los registros y los inicios de sesión los hace la persona.** Tú le dices a qué página entrar y qué botón tocar.
- **Antes de cualquier cosa que cueste dinero, dile cuánto y espera su sí:** comprar el número, una llamada de prueba, las pruebas del simulador. Retell cobra cada minuto, también los de prueba.
- Al terminar cada fase, corre `npm run revisar` y cuéntale en una línea cómo va.
- Si algo falla, lee el error, explícaselo en simple y arréglalo. Si no puedes, dile qué buscar o a quién preguntarle en la comunidad de ConstruIA.

## Antes de empezar
1. Comprueba que estás en la carpeta de Lisa (aquí hay un `package.json` con `"name": "lisa"`).
2. **La carpeta no puede estar dentro de OneDrive, iCloud ni Dropbox**, porque se traban subiendo miles de archivos. Si está ahí, muévela a `C:\Users\<usuario>\Proyectos\lisa` (Windows) o a `~/Proyectos/lisa` (Mac), y sigue desde ahí.
3. Comprueba que Node.js existe (`node -v`, versión 20 o más). Si no está, pídele que lo instale desde nodejs.org (botón LTS) y que vuelva a abrir Claude Code.
4. Corre `npm install` y después `npm test` (son pruebas gratis de la agenda; deben pasar todas).
5. Cuéntale a la persona qué van a hacer, en 4 líneas:
   - le vas a hacer unas preguntas de su compañía;
   - va a crear 3 cuentas (Anthropic, Retell y Vercel) y conectar su Google Calendar;
   - Lisa se publica en internet;
   - al final le dan un número y la prueban llamando.
   Dile que toma entre 45 minutos y una hora, y que puede parar cuando quiera: `npm run revisar` muestra dónde se quedó.
   **Si todavía no quiere número, puede hacer todo menos la fase 5:** Lisa queda lista y la puede oír desde el navegador; el número se conecta otro día.

## Fase 1: la entrevista
Haz estas preguntas **una por una** y guarda las respuestas en `negocio/datos.json`. Las claves del JSON son exactamente estas (mira `pruebas/negocio-ejemplo.json`, la compañía de ejemplo "Techos Ejemplo LLC"):

| Clave | Pregunta | Ejemplo |
|---|---|---|
| `NOMBRE_AGENTE` | ¿Cómo quieres que se llame tu agente? (si no sabe: Lisa) | Lisa |
| `COMPANIA` | ¿Cómo se llama tu compañía? | Techos Ejemplo LLC |
| `DUENO` | ¿Cómo te llamas? (el dueño o la persona a cargo) | Carlos Pérez |
| `CIUDAD` / `ESTADO` | ¿En qué ciudad y estado está la compañía? | Houston / Texas |
| `ZONA_SERVICIO` | ¿Hasta dónde llegan a trabajar? | 50 millas alrededor de Houston (Katy, Cypress, Spring...) |
| `ZIPS` | Los primeros 3 dígitos de los códigos postales donde trabajan. Sácalos tú de la zona y confírmaselos. Vacío si no quiere filtrar. | 770, 773, 774, 775 |
| `SERVICIOS` | ¿Qué trabajos hacen? | reemplazo, reparaciones, aseguranza y gutters |
| `HORARIO_INSPECCIONES` | ¿Qué días y a qué horas hacen inspecciones? (como se dice en voz) | de lunes a sábado, de 9 de la mañana a 5 de la tarde |
| `AGENDA_DIAS` | Lo mismo, en números: 1 = lunes ... 7 = domingo | 1,2,3,4,5,6 |
| `AGENDA_DESDE` / `AGENDA_HASTA` | Primera hora y hora en que termina la última inspección (24 h) | 09:00 / 17:00 |
| `AGENDA_DURACION` | ¿Cuántos minutos se aparta por inspección? | 60 |
| `ZONA_HORARIA` | La de la compañía (Texas: America/Chicago; Florida: America/New_York; California: America/Los_Angeles) | America/Chicago |
| `CONTACTO_HUMANO` | Cuando Lisa tenga que pasar a una persona, ¿a quién y a qué número? (como se dice en voz) | Carlos, al 832 555 0199 |
| `TELEFONO_TRANSFERIR` | ¿Quieres que Lisa pase la llamada en vivo a esa persona? Si sí, el número con +1. Si no, vacío. | +18325550199 |
| `CORREOS_EQUIPO` | ¿A qué correos le llegan los avisos y las citas? (separados por coma) | carlos@techosejemplo.com |
| `CALENDARIO` | ¿En qué calendario de Google van las citas? Si es el principal de su cuenta: `primary`. | primary |
| `PAGINA_WEB` | ¿Tienes página web? (si no: "no tenemos página web") | techosejemplo.com |
| `IDIOMAS` | ¿En qué idiomas atienden? | español e inglés |
| `IDIOMA_SALUDO` | ¿Lisa contesta en español (`es`) o en inglés (`en`)? Cambia sola al idioma del cliente. | es |

Después pregúntale, también una por una, lo que hace distinta a su compañía. Guárdalo en `negocio/compania.md` con sus propias palabras, usando `negocio/plantilla.md` como guía:
- desde cuándo trabajan y por qué el cliente confía en ellos;
- marcas que instalan y certificaciones;
- garantías (de material y de mano de obra);
- financiamiento (si lo tienen y el link);
- reseñas (cuántas y dónde);
- seguros (liability, workers comp);
- cuánto tarda un trabajo típico;
- formas de pago;
- si tienen servicio de emergencia (y si tiene precio fijo, cuál);
- cualquier cosa que nunca deba decir Lisa.

**No inventes nada.** Lo que la persona no sepa, déjalo fuera. Lisa solo dice lo que está ahí. **Que sea corto:** Lisa habla por teléfono, y un texto largo la hace más lenta para contestar.

Al terminar, léele un resumen y pregúntale si está bien.

**Documentos propios (opcional):** si tiene manuales de sus marcas o documentos **que son suyos o que compró**, puede ponerlos en `conocimiento/privado/` como notas `.md` cortas, por tema. Esa carpeta nunca se sube a GitHub. Explícale que no debe poner ahí documentos que no tenga derecho a usar.

## Fase 2: probar a Lisa antes de conectar nada
Aquí Lisa contesta por escrito en la Terminal, con el mismo guion y las mismas herramientas que en una llamada, pero sin teléfono y sin gastar saldo de Retell. Su calendario es de mentira: nada se agenda de verdad.

1. La cuenta de **Anthropic** (solo para estas pruebas):
   - que entre a **console.anthropic.com**, se registre y agregue un método de pago en *Billing*;
   - que ponga un **límite de gasto mensual** en *Limits* (por ejemplo, $10);
   - que cree una clave en *API Keys*.
2. Pídele que **ella misma** corra en la Terminal `npm run claves -- ANTHROPIC_API_KEY` y pegue la clave cuando se la pida. En Claude Code puede escribir `!` antes del comando.
3. Dile el costo y espera su sí: **`npm run pruebas` cuesta menos de $1** (18 llamadas de prueba y un revisor). Córrelo. Cuéntale cuántas pasaron y qué falló, en simple.
4. Corre `npm run simular` y dile que le "llame" a Lisa escribiendo como si fuera un cliente. Esto lo hace la persona en la Terminal. Cada conversación cuesta un par de centavos. Si algo no le gusta ("está muy formal", "no digas X"), corrige `negocio/compania.md` y vuelve a probar.

## Fase 3: las cuentas y las claves
Ve una por una.

1. **Retell** (la voz y el teléfono de Lisa): **dashboard.retellai.com** → registrarse.
   - Retell regala unos $10 de saldo al empezar. Explícale que cada minuto de llamada cuesta unos **10 centavos** (voz, cerebro y teléfono) y el número **$2 al mes**.
   - Que agregue un método de pago en *Billing* y **prenda la recarga automática** (*auto-recharge*), con un tope. **Sin saldo, Lisa no contesta:** es lo que más nos ha pasado.
   - La clave: *Settings → API Keys*. Que use la que tiene la etiqueta **webhook**.
   - Que ella corra `npm run claves -- RETELL_API_KEY` y la pegue.
2. **Google Calendar y Gmail** (donde Lisa ve la agenda, pone las citas y manda los avisos). No hace falta Google Cloud: es un script dentro de su propia cuenta de Google.
   - Corre `npm run google`. Crea el código del script con su clave secreta y sus correos, y lo deja copiado.
   - Que entre a **script.google.com** con la cuenta de Google del calendario de la compañía → **Nuevo proyecto**.
   - Que borre lo que hay en el editor, pegue (Ctrl+V o Cmd+V) y guarde (el ícono del disquete). Que le ponga de nombre "Lisa".
   - Que escoja la función **darPermisos** arriba y toque **▶ Ejecutar**. Google le va a pedir permisos: *Revisar permisos* → su cuenta → si sale "Google no verificó esta app", *Configuración avanzada* → *Ir a Lisa (no seguro)* → *Permitir*. Explícale que sale ese aviso porque el script es suyo y no está publicado en una tienda; solo lo usa ella.
   - Que toque **Implementar → Nueva implementación** → el engrane → **Aplicación web**. *Ejecutar como*: **Yo**. *Quién tiene acceso*: **Cualquier usuario**. → **Implementar**.
   - Que copie la **URL de la aplicación web** (termina en `/exec`) y corra `npm run claves -- GOOGLE_SCRIPT_URL` para pegarla.
   - Corre `npm run google -- probar`. Debe decir ✅ con el nombre de su calendario.
   - Explícale: "Cualquier usuario" quiere decir que Lisa le puede hablar desde internet, pero sin la clave secreta el script no hace nada.
   - Lisa bloquea las horas que estén **Ocupado** en ese calendario. Lo que esté como **Disponible** no bloquea.
3. **Vercel** (donde viven las herramientas de Lisa): vercel.com → *Sign up*.
   - El plan gratis (Hobby) es solo para uso personal. Para su compañía va el plan **Pro (unos $20 al mes)**. Puede probar en Hobby y cambiarse antes de usarlo con clientes. Si ya tiene Bobby en Vercel, es la misma cuenta.
   - Después corre `npx vercel login`, que abre el navegador para que entre.

## Fase 4: publicar a Lisa
1. `npm run publicar`: sube las claves a Vercel y publica las herramientas. Al final imprime la dirección (algo como `https://lisa-llamadas.vercel.app`).
2. Abre `<dirección>/api/salud` en el navegador. Debe decir "Lisa está despierta y conectada con Google."
3. `npm run agente`: crea a Lisa en Retell con su guion, su voz (por defecto Cleo, que suena bien en inglés y en español) y sus herramientas, y publica la versión. Esto no cuesta.
4. **Oír a Lisa sin número (modo sin número):** en dashboard.retellai.com → *Agents* → su agente → **Test** (llamada desde el navegador, con el micrófono). **Antes, dile que cuesta lo mismo que una llamada, unos 10 centavos por minuto**, y espera su sí. Que le pida una inspección como si fuera un cliente: la cita se crea **de verdad** en su calendario y el aviso le llega a su correo. Después la borra.
   - Si no le gusta la voz, que escoja otra en *Voices* (que la oiga en inglés y en español), guarda su nombre en `.env.local` como `LISA_VOZ` y vuelve a correr `npm run agente`.
5. **Pregúntale si quiere el número ahora.**
   - Si sí, sigue con la fase 5.
   - Si no, para aquí. Explícale en 3 líneas lo que falta (comprar un número de Retell, $2 al mes, y, si quiere, desviar las llamadas de su número de siempre) y que el día que quiera solo abre Claude Code en esta carpeta y dice "quiero conectar el número de Lisa". Corre `npm run revisar` para que vea que todo está ✅ menos el número.

## Fase 5: el número de teléfono
**Lee esto con la persona antes de tocar nada:**
- Lisa contesta en un **número de Retell** (cuesta $2 al mes). No hace falta Twilio.
- **Su número de siempre no se mueve ni se pierde.** Si quiere que Lisa conteste las llamadas que llegan a ese número, se usa el **desvío de llamadas** de su compañía de teléfono, y lo puede quitar cuando quiera.

1. Pregúntale de qué código de área quiere el número (por ejemplo, 832). Dile: "Esto compra un número de $2 al mes". Con su sí, corre `npm run numero -- comprar <código> --si`.
   - Si ya compró un número en el dashboard de Retell: `npm run numero -- conectar +1XXXXXXXXXX`.
2. Que llame a ese número desde su celular. Debe contestar Lisa.
3. **Desviar su número de siempre (opcional).** Recomiéndale el desvío **solo cuando no contesta o está ocupado**: así él sigue contestando, y Lisa toma las que se le van. Ayúdale a buscar cómo se hace con su compañía:
   - Celulares en EE. UU.: casi siempre es un código que se marca desde el teléfono, y cambia según la compañía (AT&T, T-Mobile, Verizon...) y el plan. Búscalo en la página de soporte de su compañía ("conditional call forwarding no answer") y dáselo tal cual; no lo digas de memoria.
   - Teléfonos de oficina o por internet (RingCentral, Google Voice, OpenPhone, Grasshopper...): en la app, en *Call forwarding* o *Desvío*.
   - Después del desvío, que haga una llamada de prueba desde otro teléfono y no conteste.
4. También puede poner el número de Lisa directo en su Google Business, su página o sus anuncios.

## Fase 6: la prueba de verdad
Antes, dile el costo: **unas 5 llamadas de 2 o 3 minutos, unos $1.50 en total de su saldo de Retell.**

1. **Gotera:** que llame (desde otro teléfono si tiene el desvío) y pida una inspección. Lisa debe preguntar el nombre al principio, leer la dirección con el ZIP, preguntar quién decide y ofrecer dos horarios. Después: la cita aparece en su calendario con todos los datos, y le llega el correo.
2. **Precio:** "¿Cuánto cuesta un techo?". Lisa no da número y ofrece la inspección gratis.
3. **Una persona:** "Quiero hablar con alguien". Si tiene `TELEFONO_TRANSFERIR`, Lisa pasa la llamada en vivo (esa persona oye primero un resumen). Si no, deja el aviso, y solo después de que le llegó al equipo le dice al cliente que lo van a llamar.
4. **La red de seguridad:** que llame, diga su nombre y qué le pasa, y cuelgue sin agendar. En un par de minutos le llega un correo "Llamar de vuelta" con el resumen y queda en su calendario. Ningún cliente se queda sin atender.
5. Que revise todo en dashboard.retellai.com → *Call History*: grabación, transcripción y resumen de cada llamada.
6. Corre `npm run revisar`. Todo debe salir en ✅.

Explícale lo que tiene que saber del día a día:
- **Cada llamada le deja algo:** la cita en el calendario (con correo), o un aviso "Llamar de vuelta" o "URGENTE" (con correo), o el resumen por correo si se transfirió.
- **Para cambiar lo que sabe Lisa:** editar `negocio/compania.md` (o pedírtelo a ti) y correr `npm run agente`. No hace falta volver a publicar.
- **Gastos:** revisar de vez en cuando el saldo de Retell (*Billing*) y que la recarga automática siga prendida.
- **Si Lisa no contesta:** abrir Claude Code en esta carpeta y decir "Lisa no contesta, revisa qué pasa". Revisa el saldo de Retell, `<dirección>/api/salud`, `npm run revisar` y `npx vercel logs <dirección>`.

## Si algo falla
- **Lisa contesta pero dice que no puede ver la agenda:** el script de Google no responde. Corre `npm run google -- probar`. Si cambió el código del script, hay que volver a implementar: *Implementar → Administrar implementaciones → editar → Nueva versión*. La URL no cambia.
- **"clave incorrecta" en Google:** el código pegado es viejo. `npm run google`, pegar otra vez, guardar y volver a implementar.
- **`/api/salud` dice que faltan claves:** corre `npm run publicar` otra vez.
- **Las herramientas dicen "firma inválida" en los logs de Vercel:** la `RETELL_API_KEY` no es la de la etiqueta webhook. Cámbiala con `npm run claves -- RETELL_API_KEY` y corre `npm run publicar`.
- **`npm run agente` da un error de Retell:** lee el mensaje; casi siempre es un campo que Retell cambió. Revisa la documentación en docs.retellai.com y ajusta `scripts/agente.mjs`.
- **No llega el correo de los avisos:** que revise la carpeta de spam y que `CORREOS_EQUIPO` esté bien. Gmail permite unos 100 correos al día desde un script en una cuenta gratis.
- **Lisa se corta al principio:** sube `begin_message_delay_ms` en `scripts/agente.mjs` y corre `npm run agente`.
