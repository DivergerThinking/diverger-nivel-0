// La PR de una tarea lleva la aprobación del revisor de código en su último commit (EN-OPS-08, ADR 0008 del harness).
// Uso en el CI: node scripts/revisor.mjs <base>..<head>, con PR_RAMA, REPO y GH_TOKEN, desde la rama base.
// El worker del modo desatendido revisa su cambio con el agente revisor-codigo del harness y, si lo aprueba, publica
// en el commit el estado revisor-codigo con el token de su job, cuyo autor es github-actions[bot]. Este script lo
// exige en la PR de una tarea: la de la rama de un worker (diverger/<iniciativa>/<tarea>) cuya tarea existe en
// .diverger/<iniciativa>/tasks/ de la rama base. El trailer Diverger-Tarea no basta: también lo llevan commits de
// personas con ids de tareas del harness, y su PR esperaría para siempre un revisor que solo lanza el worker
// (golden-path#70). No es de una tarea la del plan, la de la aplicación de un cambio ni las de mantenimiento del kit
// de evaluación: pasan sin revisión. Un commit nuevo en la rama no tiene el estado, así que la PR vuelve a fallar
// hasta que un worker lo revise: la salida es cerrar la PR y relanzar la tarea. Con la política automática, el ruleset exige este job.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ramaDeMantenimiento, ramaDelWorker } from "./trailers.mjs";

export const CONTEXTO = "revisor-codigo";
export const AUTOR = "github-actions[bot]";

/** Un id de tarea, como los que acepta el worker: sin barras, así que no sale de la carpeta tasks/. */
const TAREA = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/**
 * La tarea de la PR, si es la de un worker: su rama es diverger/<iniciativa>/<tarea>, no de mantenimiento, y la
 * tarea existe en .diverger/<iniciativa>/tasks/ de `base`, la carpeta con la rama base. Si no, no es de una tarea.
 */
export function tareaDeLaPR(rama = "", base = process.cwd()) {
  if (ramaDeMantenimiento(rama)) return { tareas: [], motivo: "" };
  const worker = ramaDelWorker(rama);
  if (!worker) return { tareas: [], motivo: "" };
  const fichero = join(".diverger", worker.iniciativa, "tasks", `${worker.tarea}.json`);
  if (!TAREA.test(worker.tarea) || !existsSync(join(base, fichero))) {
    return { tareas: [], motivo: ` Su rama, ${rama}, tiene la forma de la de un worker, pero la rama base no tiene `
      + `${fichero.replaceAll("\\", "/")}.` };
  }
  return { tareas: [worker.tarea], motivo: "" };
}

/**
 * Qué pasa con la PR. estados es la lista de GitHub de los estados del último commit, del más reciente al más antiguo:
 * vale el más reciente con el contexto revisor-codigo, si lo publicó github-actions[bot] y está en success.
 */
export function veredicto(tareasPR, estados, motivo = "") {
  if (tareasPR.length === 0) {
    return { falla: false, mensaje: `No es la PR de una tarea: no necesita la revisión del revisor de código.${motivo}` };
  }
  const nombre = tareasPR.join(", ");
  const estado = (Array.isArray(estados) ? estados : []).find((e) => e?.context === CONTEXTO);
  if (!estado) {
    return { falla: true, mensaje: `La PR de la tarea ${nombre} no tiene la aprobación del revisor de código en su último `
      + "commit. La publica el worker del modo desatendido cuando el revisor aprueba su cambio; un commit que no viene de "
      + "un worker no la tiene. Con la política automática nadie aprueba las PR, así que la de una tarea solo se integra "
      + "con esa revisión. Si un commit posterior, como «Update branch» o la resolución de un conflicto, se la ha quitado, "
      + "cierra la PR y relanza la tarea, para que un worker la vuelva a construir y revisar: con la PR abierta, el worker "
      + "trabaja y acaba fallando al abrir la suya." };
  }
  if (estado.creator?.login !== AUTOR) {
    return { falla: true, mensaje: `El estado ${CONTEXTO} de la PR de la tarea ${nombre} lo ha publicado `
      + `${estado.creator?.login ?? "alguien desconocido"}, no el job del worker (${AUTOR}): no vale como revisión.` };
  }
  if (estado.state !== "success") {
    return { falla: true, mensaje: `El estado ${CONTEXTO} de la PR de la tarea ${nombre} está en ${estado.state}, no en success.` };
  }
  return { falla: false, mensaje: `El revisor de código aprobó el último commit de la PR de la tarea ${nombre}.` };
}

/** Los estados del commit, de la API de GitHub (del más reciente al más antiguo). */
export function estadosDelCommit(repo, sha) {
  const salida = execFileSync("gh", ["api", `repos/${repo}/commits/${sha}/statuses?per_page=100`], { encoding: "utf8" });
  return JSON.parse(salida);
}

export function comprobar(rango, rama = "", repo = "", cwd = process.cwd()) {
  const { tareas: lista, motivo } = tareaDeLaPR(rama, cwd);
  if (lista.length === 0) return veredicto(lista, [], motivo);
  const [, cabeza] = rango.split("..");
  if (!/^[0-9a-f]{40}$/.test(cabeza ?? "")) throw new Error(`El rango «${rango}» no acaba en un commit`);
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repo)) throw new Error(`El repositorio «${repo}» no es válido`);
  return veredicto(lista, estadosDelCommit(repo, cabeza));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  let resultado;
  try {
    resultado = comprobar(process.argv[2] ?? "", process.env.PR_RAMA ?? "", process.env.REPO ?? "");
  } catch (error) {
    console.error(`::error::No se puede comprobar la revisión del revisor de código: ${error.message}`);
    process.exit(1);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Revisor de código\n\n${resultado.mensaje}\n`);
  }
  if (resultado.falla) {
    console.error(`::error::${resultado.mensaje}`);
    process.exit(1);
  }
  console.log(resultado.mensaje);
}
