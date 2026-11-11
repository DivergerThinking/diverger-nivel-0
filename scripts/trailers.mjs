// Trailers de autoría de los commits de agentes (EN-OPS-02): rol, modelo y tarea. Los commits del
// harness, además, dicen qué persona lo lanzó (EN-OPS-06, RQ.066): Diverger-Iniciado-por y su
// Co-authored-by con el correo noreply de GitHub, y el CI lo compara con quien lanzó la ejecución.
// Uso en el CI: node scripts/trailers.mjs <base>..<head>. Falla si un commit de agente no los lleva.
// Para los commits del harness lee la descripción de la PR PR_NUMERO de la API (el enlace al job del
// worker y «Lanzado por»; sin número, de PR_CUERPO), PR_AUTOR (quien la abrió), PR_RAMA
// (diverger/<iniciativa>/<tarea>) y PR_BASE (su rama base), y pregunta a la API de GitHub con
// GH_TOKEN (scripts/lanzador.mjs).
// Excepción (harness#528): en las ramas de mantenimiento del kit de evaluación del harness,
// diverger/reinicio/<número> y diverger/ajustes/<número>, los commits del harness llevan los cuatro
// trailers, pero no se comparan con una ejecución del worker: los hacen preparar-nivel-0.yml y
// ajustes-nivel-0.yml del harness, que es privado, y el CI de la aplicación no puede leer sus ejecuciones.
// Se comprueba que Diverger-Iniciado-por es una persona (no un bot) y que lleva su Co-authored-by noreply.
// La descripción de una PR del harness, la que abre su identidad (PR_AUTOR) o la que tiene algún commit suyo, dice
// «Lanzado por @login», y ese login es el Diverger-Iniciado-por de sus commits (EN-OPS-07, ADR 0047 del harness).
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { apiDeGitHub, correoNoreply, esBot, persona as personaDeGitHub, quienLanzo } from "./lanzador.mjs";

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
  } else if (esBot(commit.iniciadoPor)) {
    faltan.push(`El trailer de quien lanzó el harness es una GitHub App, no una persona `
      + `(${TRAILERS.iniciadoPor}: ${commit.iniciadoPor}): ${corto}`);
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

/** El login de «Lanzado por @login» en la descripción de una PR, o undefined si no lo dice. */
export function lanzadoPorDelCuerpo(cuerpo) {
  return /(?:^|\s)Lanzado por @([A-Za-z0-9][A-Za-z0-9-]{0,38})(?![A-Za-z0-9-])/.exec(cuerpo ?? "")?.[1];
}

/**
 * Errores de la descripción de la PR (EN-OPS-07). Solo mira las PR del harness: las que abre su identidad (`autor`)
 * o las que tienen algún commit suyo. Tienen que decir «Lanzado por @login», con el login del Diverger-Iniciado-por
 * de sus commits del harness, que `problemas` ya compara con quien lanzó la ejecución.
 */
export function problemasDeLaPr(lista, { autor, cuerpo } = {}) {
  const delHarness = lista.filter(esDelHarness);
  if (autor !== HARNESS && !delHarness.length) return [];
  const login = lanzadoPorDelCuerpo(cuerpo);
  if (!login) return ["Falta “Lanzado por” en la descripción de la PR"];
  const otros = new Set(delHarness.map((commit) => commit.iniciadoPor)
    .filter((quien) => quien && quien.toLowerCase() !== login.toLowerCase()));
  return [...otros].map((quien) => `“Lanzado por @${login}” no coincide con quien lanzó el harness (${TRAILERS.iniciadoPor}: ${quien})`);
}

/**
 * La descripción actual de la PR `numero`, leída de la API. Sin número (fuera del CI) vale `porDefecto`.
 */
export async function descripcionDeLaPr(api, repo, numero, porDefecto) {
  if (!numero) return porDefecto;
  if (!/^[0-9]+$/.test(numero)) throw new Error(`el número de la PR no es válido: ${numero}`);
  const pr = await api(`repos/${repo}/pulls/${numero}`);
  return typeof pr?.body === "string" ? pr.body : "";
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
 * Una rama de mantenimiento del kit de evaluación del harness: diverger/reinicio/<número> (preparar-nivel-0.yml)
 * o diverger/ajustes/<número> (ajustes-nivel-0.yml), con el número de su ejecución. Solo esas dos formas:
 * también encajan con ramaDelWorker, así que se decide antes, y el worker no admite esas iniciativas.
 */
export function ramaDeMantenimiento(rama) {
  const partes = /^diverger\/(reinicio|ajustes)\/([0-9]+)$/.exec(rama ?? "");
  return partes ? { workflow: partes[1], ejecucion: partes[2] } : undefined;
}

async function intentar(funcion) {
  try {
    return await funcion();
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Errores de todos los commits del rango. `lanzador()` solo se llama si hay commits del harness, una vez,
 * y devuelve la persona que lanzó la ejecución o lanza un Error con el motivo.
 *
 * En una rama de mantenimiento (`usuario`), los commits del harness no se comparan con una ejecución:
 * `usuario(login)` devuelve la persona de su Diverger-Iniciado-por ({ login, id }) o lanza un Error, y se
 * comprueba su Co-authored-by con ese id. `lanzador` no se llama.
 */
export async function comprobar(lista, lanzador, { usuario } = {}) {
  if (usuario) {
    const personas = new Map();
    const errores = [];
    for (const commit of lista) {
      let quien;
      if (esDelHarness(commit) && commit.iniciadoPor && !esBot(commit.iniciadoPor)) {
        const clave = commit.iniciadoPor.toLowerCase();
        if (!personas.has(clave)) personas.set(clave, await intentar(() => usuario(commit.iniciadoPor)));
        quien = personas.get(clave);
      }
      errores.push(...problemas(commit, quien));
    }
    return errores;
  }
  const persona = lista.some(esDelHarness) ? await intentar(lanzador) : undefined;
  return lista.flatMap((commit) => problemas(commit, persona));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const rango = process.argv[2];
  if (!rango) {
    console.error("Uso: node scripts/trailers.mjs <base>..<head>");
    process.exit(2);
  }
  const api = apiDeGitHub();
  // La excepción se decide antes que la rama del worker, y solo con la forma exacta de la rama.
  const mantenimiento = ramaDeMantenimiento(process.env.PR_RAMA) ? {
    usuario: async (login) => {
      try {
        return await personaDeGitHub(api, login);
      } catch (error) {
        throw new Error(`no se encuentra a ${login} en GitHub: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
    },
  } : {};
  const lista = commits(rango);
  const autor = process.env.PR_AUTOR;
  const errores = [];
  // La descripción, de la API y no del evento: un «Re-run» del job repite el evento con la descripción de entonces.
  // Solo se lee si la PR es del harness, así que las de las personas no dependen de la API.
  let cuerpo = process.env.PR_CUERPO;
  if (autor === HARNESS || lista.some(esDelHarness)) {
    try {
      cuerpo = await descripcionDeLaPr(api, process.env.GITHUB_REPOSITORY ?? "", process.env.PR_NUMERO, cuerpo);
    } catch (error) {
      cuerpo = "";
      errores.push(`No se puede leer la descripción de la PR: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  errores.push(...problemasDeLaPr(lista, { autor, cuerpo }), ...await comprobar(lista, () => {
    const ejecucion = ejecucionDelCuerpo(cuerpo);
    if (!ejecucion) throw new Error("la PR no enlaza el job del worker que la abrió");
    const rama = ramaDelWorker(process.env.PR_RAMA);
    if (!rama) throw new Error(`la rama de la PR (${process.env.PR_RAMA ?? ""}) no es la de un worker (diverger/<iniciativa>/<tarea>)`);
    return quienLanzo({ api, repo: process.env.GITHUB_REPOSITORY ?? "", ejecucion,
      iniciativa: rama.iniciativa, pr: { tarea: rama.tarea, base: process.env.PR_BASE ?? "" } });
  }, mantenimiento));
  for (const error of errores) console.error(error);
  process.exit(errores.length ? 1 : 0);
}
