// El número de teléfono de Lisa (un número de Retell, $2 al mes).
//   npm run numero                          → muestra el número y a qué agente apunta
//   npm run numero -- comprar 832 --si      → compra un número con ese código de área y lo conecta a Lisa
//   npm run numero -- conectar +18325550123 → conecta a Lisa un número que ya compraste en Retell
// Comprar cuesta dinero: Claude Code siempre le pregunta a la persona antes y solo entonces agrega --si.
import { guardarEnv, leerEnv, requerir } from "./_util.mjs";
import { leerDatos, rutaDatos } from "./armar-prompt.mjs";

const vars = leerEnv();
requerir(vars, "RETELL_API_KEY", "RETELL_AGENT_ID");
const [accion, valor] = process.argv.slice(2).filter((a) => !a.startsWith("--"));

async function retell(metodo, ruta, cuerpo) {
  const r = await fetch(`https://api.retellai.com${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${vars.RETELL_API_KEY}`, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Retell ${metodo} ${ruta} → ${r.status}: ${texto.slice(0, 400)}`);
  return texto ? JSON.parse(texto) : {};
}

const aLisa = { inbound_agents: [{ agent_id: vars.RETELL_AGENT_ID, weight: 1, agent_version: "latest_published" }] };

if (accion === "comprar") {
  const area = Number(valor);
  if (!(area >= 200 && area <= 999)) {
    console.error("\nDime el código de área, por ejemplo: npm run numero -- comprar 832 --si\n");
    process.exit(1);
  }
  if (!process.argv.includes("--si")) {
    console.error(`\nEsto compra un número de Retell con el código ${area}: cuesta unos $2 al mes y se cobra de tu saldo de Retell.`);
    console.error(`Si la persona está de acuerdo, corre: npm run numero -- comprar ${area} --si\n`);
    process.exit(1);
  }
  const datos = leerDatos(rutaDatos());
  const n = await retell("POST", "/create-phone-number", {
    area_code: area,
    nickname: `${datos.NOMBRE_AGENTE} · ${datos.COMPANIA}`,
    ...aLisa,
  });
  vars.RETELL_NUMERO = n.phone_number;
  guardarEnv(vars);
  console.log(`\n✅ Número comprado y conectado a Lisa: ${n.phone_number_pretty ?? n.phone_number}`);
  console.log("Llama a ese número desde tu celular para probarla.\n");
} else if (accion === "conectar") {
  const numero = String(valor ?? "").replace(/[^\d+]/g, "");
  if (!/^\+\d{11,15}$/.test(numero)) {
    console.error("\nEscribe el número con +1, por ejemplo: npm run numero -- conectar +18325550123\n");
    process.exit(1);
  }
  await retell("PATCH", `/update-phone-number/${encodeURIComponent(numero)}`, aLisa);
  vars.RETELL_NUMERO = numero;
  guardarEnv(vars);
  console.log(`\n✅ ${numero} ahora lo contesta Lisa.\n`);
} else {
  const lista = await retell("GET", "/list-phone-numbers");
  const mios = (Array.isArray(lista) ? lista : []).filter((n) =>
    (n.inbound_agents ?? []).some((a) => a.agent_id === vars.RETELL_AGENT_ID) || n.inbound_agent_id === vars.RETELL_AGENT_ID,
  );
  if (!mios.length) console.log("\nLisa todavía no tiene número. Para comprar uno: npm run numero -- comprar <código de área> --si\n");
  for (const n of mios) console.log(`\n📞 ${n.phone_number_pretty ?? n.phone_number} lo contesta Lisa.`);
  console.log();
}
