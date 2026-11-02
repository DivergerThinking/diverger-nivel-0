// Trailers de autoría de los commits de agentes (EN-OPS-02): rol, modelo y tarea. Los commits del
// harness, además, dicen qué persona lo lanzó (EN-OPS-06, RQ.066): Diverger-Iniciado-por y su
// Co-authored-by con el correo noreply de GitHub, y el CI lo compara con quien lanzó la ejecución.
// Uso en el CI: node scripts/trailers.mjs <base>..<head>. Falla si un commit de agente no los lleva.
// Para los commits del harness lee la PR de PR_CUERPO (el enlace al job del worker), PR_RAMA
// (diverger/<iniciativa>/<tarea>) y PR_BASE (su rama base), y pregunta a la API de GitHub con
// GH_TOKEN (scripts/lanzador.mjs).
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { apiDeGitHub, correoNoreply, esBot, quienLanzo } from "./lanzador.mjs";

export const TRAILERS = {
  rol: "Diverger-Rol", modelo: "Diverger-Modelo", tarea: "Diverger-Tarea", iniciadoPor: "Diverger-Iniciado-por",
};

/** La identidad del harness (EN-OPS-05): autor de sus commits. */
export const HARNESS = "diverger-harness[bot]";

// Un commit es de un agente si lleva algún trailer de Diverger o un Co-Authored-By de Claude.
const COAUTOR_CLAUDE = /claude|anthropic\.com/i;
const SEP = "\x1f";
const FIN = "\x1e";

/** Commits del rango, sin los de merge, con su autor, sus trailers de Diverger y sus coautores. */
export function commits(rango, cwd = process.cwd()) {
  const campos = ["%H", "%s", "%an", ...Object.values(TRAILERS).map((t) => `%(trailers:key=${t},valueonly,separator=%x2C)`),
    "%(trailers:key=Co-Authored-By,valueonly,separator=%x2C)"];
  const salida = execFileSync("git", ["log", "--no-merges", `--format=${campos.join("%x1f")}%x1e`, rango],
    { cwd, encoding: "utf8" });
  return salida.split(FIN).map((bloque) => bloque.trim()).filter(Boolean).map((bloque) => {
    const [sha = "", asunto = "", autor = "", rol = "", modelo = "", tarea = "", iniciadoPor = "", coautores = ""] = bloque.split(SEP);
    return { sha, asunto, autor: autor.trim(), rol: rol.trim(), modelo: modelo.trim(), tarea: tarea.trim(),
      iniciadoPor: iniciadoPor.trim(), coautores: coautores.trim() };
  });
}

function deAgente(commit) {
  return Boolean(commit.rol || commit.modelo || commit.tarea || commit.iniciadoPor) || COAUTOR_CLAUDE.test(commit.coautores ?? "");
}

/**
 * Un commit es del harness si su autor es la identidad del harness, o una GitHub App con trailers de
 * Diverger. Los de un agente en la sesión de una persona (autor: esa persona) no lo son.
 */
export function esDelHarness(commit) {
  return commit.autor === HARNESS || (esBot(commit.autor) && deAgente(commit));
}

/**
 * Mensajes de error de un commit; vacío si es de una persona o si lleva lo que le toca. `lanzador` es
 * la persona que lanzó la ejecución ({ login, id }) o un Error con el motivo de no saberlo; solo se
 * mira en los commits del harness.
 */
export function problemas(commit, lanzador) {
  if (!deAgente(commit) && !esDelHarness(commit)) return [];
  const corto = `${commit.sha.slice(0, 7)} ${commit.asunto}`;
  const faltan = [];
  if (!commit.rol) faltan.push(`Falta el trailer de rol (${TRAILERS.rol}): ${corto}`);
  if (!commit.modelo) faltan.push(`Falta el trailer de modelo (${TRAILERS.modelo}): ${corto}`);
  if (!commit.tarea) faltan.push(`Falta el trailer de tarea (${TRAILERS.tarea}): ${corto}`);
  if (!esDelHarness(commit)) return faltan;
  if (!commit.iniciadoPor) {
    faltan.push(`Falta el trailer de quien lanzó el harness (${TRAILERS.iniciadoPor}): ${corto}`);
  } else if (!lanzador || lanzador instanceof Error) {
    faltan.push(`No se puede comprobar quién lanzó la ejecución: ${lanzador?.message ?? "no se sabe"}: ${corto}`);
  } else if (commit.iniciadoPor.toLowerCase() !== lanzador.login.toLowerCase()) {
    faltan.push(`El trailer de quien lanzó el harness no coincide con quien lanzó la ejecución `
      + `(${TRAILERS.iniciadoPor}: ${commit.iniciadoPor}; la lanzó ${lanzador.login}): ${corto}`);
  } else if (!commit.coautores.toLowerCase().includes(`<${correoNoreply(lanzador.login, lanzador.id)}>`.toLowerCase())) {
    faltan.push(`Falta el Co-authored-by de quien lanzó el harness con su correo noreply `
      + `(${correoNoreply(lanzador.login, lanzador.id)}): ${corto}`);
  }
  return faltan;
}

/** El id del job del worker que enlaza la descripción de su PR («Job del worker: …/actions/runs/<id>»). */
export function ejecucionDelCuerpo(cuerpo) {
  return /Job del worker: \S*\/actions\/runs\/(\d+)/.exec(cuerpo ?? "")?.[1];
}

/** La iniciativa y la tarea de la rama de un worker, diverger/<iniciativa>/<tarea>. */
export function ramaDelWorker(rama) {
  const partes = /^diverger\/([a-z0-9][a-z0-9-]{0,63})\/([^/]+)$/.exec(rama ?? "");
  return partes ? { iniciativa: partes[1], tarea: partes[2] } : undefined;
}

/**
 * Errores de todos los commits del rango. `lanzador()` solo se llama si hay commits del harness, una vez,
 * y devuelve la persona que lanzó la ejecución o lanza un Error con el motivo.
 */
export async function comprobar(lista, lanzador) {
  let persona;
  if (lista.some(esDelHarness)) {
    try {
      persona = await lanzador();
    } catch (error) {
      persona = error instanceof Error ? error : new Error(String(error));
    }
  }
  return lista.flatMap((commit) => problemas(commit, persona));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const rango = process.argv[2];
  if (!rango) {
    console.error("Uso: node scripts/trailers.mjs <base>..<head>");
    process.exit(2);
  }
  const errores = await comprobar(commits(rango), () => {
    const ejecucion = ejecucionDelCuerpo(process.env.PR_CUERPO);
    if (!ejecucion) throw new Error("la PR no enlaza el job del worker que la abrió");
    const rama = ramaDelWorker(process.env.PR_RAMA);
    if (!rama) throw new Error(`la rama de la PR (${process.env.PR_RAMA ?? ""}) no es la de un worker (diverger/<iniciativa>/<tarea>)`);
    return quienLanzo({ api: apiDeGitHub(), repo: process.env.GITHUB_REPOSITORY ?? "", ejecucion,
      iniciativa: rama.iniciativa, pr: { tarea: rama.tarea, base: process.env.PR_BASE ?? "" } });
  });
  for (const error of errores) console.error(error);
  process.exit(errores.length ? 1 : 0);
}
