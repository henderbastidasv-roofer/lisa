// Ayudas compartidas por los scripts de Lisa. Funcionan igual en Windows y en Mac.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ENV = path.join(RAIZ, ".env.local");

export function leerEnv() {
  if (!fs.existsSync(ENV)) return {};
  const vars = {};
  for (const linea of fs.readFileSync(ENV, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) vars[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return vars;
}

export function guardarEnv(vars) {
  const texto = Object.entries(vars)
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`)
    .join("\n");
  fs.writeFileSync(ENV, texto + "\n", { mode: 0o600 });
}

export function requerir(vars, ...nombres) {
  const faltan = nombres.filter((n) => !vars[n]);
  if (faltan.length) {
    console.error(`\nFaltan estas claves en .env.local: ${faltan.join(", ")}\nCorre primero: npm run claves\n`);
    process.exit(1);
  }
}

/** Pregunta en la Terminal. Con oculto=true no se ve lo que escribes (para claves). */
export function preguntar(texto, { oculto = false } = {}) {
  if (oculto && process.stdin.isTTY) return preguntarOculto(texto);
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(texto, (respuesta) => {
      rl.close();
      resolve(respuesta.trim());
    });
  });
}

// Lee tecla por tecla sin mostrar nada: cada carácter se ve como *. Así una clave pegada nunca aparece en pantalla.
function preguntarOculto(texto) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    let valor = "";
    process.stdout.write(texto);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const alTeclear = (trozo) => {
      for (const c of trozo) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", alTeclear);
          process.stdout.write("\n");
          resolve(valor.trim());
          return;
        }
        if (c === "\u0003") {
          process.stdout.write("\n");
          process.exit(1);
        }
        if (c === "\u007f" || c === "\b") {
          if (valor.length) {
            valor = valor.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        if (c >= " ") {
          valor += c;
          process.stdout.write("*");
        }
      }
    };
    stdin.on("data", alTeclear);
  });
}

/** Corre un comando y deja ver su salida. En Windows usa el .cmd de npm/npx. */
export function correr(comando, args, { entrada, silencioso = false } = {}) {
  const cmd = process.platform === "win32" && ["npx", "npm", "vercel"].includes(comando) ? `${comando}.cmd` : comando;
  const r = spawnSync(cmd, args, {
    cwd: RAIZ,
    input: entrada,
    stdio: entrada !== undefined ? ["pipe", silencioso ? "pipe" : "inherit", "inherit"] : silencioso ? "pipe" : "inherit",
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return r;
}

export function paso(n, texto) {
  console.log(`\n=== ${n}. ${texto} ===`);
}
