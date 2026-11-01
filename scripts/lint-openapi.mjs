// Pasa el linter de OpenAPI (Redocly, con redocly.yaml) sobre el contrato de cada contexto.
import { spawnSync } from "node:child_process";
import { contratos } from "./contratos.mjs";

const lista = contratos().map(({ contrato }) => contrato);
if (lista.length === 0) {
  console.log("No hay contratos en spec/contextos/: nada que comprobar.");
  process.exit(0);
}
const resultado = spawnSync("npx", ["--no-install", "redocly", "lint", ...lista], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(resultado.status ?? 1);
