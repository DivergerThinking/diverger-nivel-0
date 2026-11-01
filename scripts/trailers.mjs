// Trailers de autoría de los commits de agentes (EN-OPS-02): rol, modelo y tarea.
// Uso en el CI: node scripts/trailers.mjs <base>..<head>. Falla si un commit de agente no los lleva.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const TRAILERS = { rol: "Diverger-Rol", modelo: "Diverger-Modelo", tarea: "Diverger-Tarea" };

// Un commit es de un agente si lleva algún trailer de Diverger o un Co-Authored-By de Claude.
const COAUTOR_CLAUDE = /claude|anthropic\.com/i;
const SEP = "\x1f";
const FIN = "\x1e";

/** Commits del rango, sin los de merge, con sus trailers de Diverger y sus coautores. */
export function commits(rango, cwd = process.cwd()) {
  const campos = ["%H", "%s", ...Object.values(TRAILERS).map((t) => `%(trailers:key=${t},valueonly,separator=%x2C)`),
    "%(trailers:key=Co-Authored-By,valueonly,separator=%x2C)"];
  const salida = execFileSync("git", ["log", "--no-merges", `--format=${campos.join("%x1f")}%x1e`, rango],
    { cwd, encoding: "utf8" });
  return salida.split(FIN).map((bloque) => bloque.trim()).filter(Boolean).map((bloque) => {
    const [sha = "", asunto = "", rol = "", modelo = "", tarea = "", coautores = ""] = bloque.split(SEP);
    return { sha, asunto, rol: rol.trim(), modelo: modelo.trim(), tarea: tarea.trim(), coautores: coautores.trim() };
  });
}

/** Mensajes de error de un commit; vacío si es de una persona o si lleva los tres trailers. */
export function problemas(commit) {
  const deAgente = Boolean(commit.rol || commit.modelo || commit.tarea) || COAUTOR_CLAUDE.test(commit.coautores);
  if (!deAgente) return [];
  const corto = `${commit.sha.slice(0, 7)} ${commit.asunto}`;
  const faltan = [];
  if (!commit.rol) faltan.push(`Falta el trailer de rol (${TRAILERS.rol}): ${corto}`);
  if (!commit.modelo) faltan.push(`Falta el trailer de modelo (${TRAILERS.modelo}): ${corto}`);
  if (!commit.tarea) faltan.push(`Falta el trailer de tarea (${TRAILERS.tarea}): ${corto}`);
  return faltan;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const rango = process.argv[2];
  if (!rango) {
    console.error("Uso: node scripts/trailers.mjs <base>..<head>");
    process.exit(2);
  }
  const errores = commits(rango).flatMap(problemas);
  for (const error of errores) console.error(error);
  process.exit(errores.length ? 1 : 0);
}
