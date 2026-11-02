// Quién lanzó una ejecución del harness (EN-OPS-06, RQ.066, ADR 0008 del harness). Lo dice GitHub, no
// el modelo: es quien lanzó el job del worker o, si lo lanzó el bucle con la identidad del harness, quien
// lanzó ese bucle. Lo usan el worker, para los trailers de su commit, y el CI, para comprobarlos.
// Uso: node scripts/lanzador.mjs <id del job del worker> <iniciativa>. Escribe en JSON
// { login, id, nombre, ejecucion } y necesita GH_TOKEN (o GITHUB_TOKEN) con lectura de Actions.
import { pathToFileURL } from "node:url";

export const WORKFLOW_WORKER = ".github/workflows/diverger-worker.yml";
export const WORKFLOW_BUCLE = ".github/workflows/diverger-bucle.yml";

/** Las cuentas de las GitHub Apps acaban en [bot]: nunca son la persona responsable. */
export function esBot(login) {
  return /\[bot\]$/.test(login ?? "");
}

/** El nombre de Co-authored-by, sin saltos de línea ni los caracteres que delimitan el correo. */
export function nombreSeguro(nombre, login) {
  const limpio = String(nombre ?? "").replace(/[<>\p{Cc}]/gu, " ").replace(/\s+/g, " ").trim();
  return limpio || login;
}

/** Correo noreply de GitHub de una persona: nunca su correo real (ADR 0010 del harness). */
export function correoNoreply(login, id) {
  return `${id}+${login}@users.noreply.github.com`;
}

function ruta(path) {
  return String(path ?? "").split("@")[0];
}

/**
 * Persona que lanzó la ejecución del job del worker `ejecucion`, en `repo`. `api(ruta)` devuelve el JSON
 * de la API REST de GitHub. Con `pr` ({ tarea, base }), comprueba además con los datos de GitHub, no con
 * lo que diga la PR, que ese job es el worker de la tarea de la PR y corrió en su rama base. Con un
 * «Re-run» cuenta quien lanzó la ejecución la primera vez (actor), no quien la relanzó. Lanza un Error
 * con el motivo si no se puede saber.
 */
export async function quienLanzo({ api, repo, ejecucion, iniciativa, pr }) {
  if (!/^\d+$/.test(String(ejecucion))) throw new Error(`El id de la ejecución «${ejecucion}» no es válido`);
  const worker = await api(`repos/${repo}/actions/runs/${ejecucion}`);
  if (ruta(worker.path) !== WORKFLOW_WORKER) {
    throw new Error(`La ejecución ${ejecucion} no es del worker (${WORKFLOW_WORKER})`);
  }
  if (pr) {
    // El nombre del job del worker es «diverger-worker <tarea> <ejecución del bucle>» (su run-name).
    const tarea = /^diverger-worker (\S+) \S+$/.exec(worker.display_title ?? "")?.[1];
    if (tarea !== pr.tarea) {
      throw new Error(`La ejecución ${ejecucion} es del worker de la tarea ${tarea ?? "(desconocida)"}, `
        + `no de la tarea ${pr.tarea} de la rama de la PR`);
    }
    if (worker.head_branch !== pr.base) {
      throw new Error(`La ejecución ${ejecucion} corrió en la rama ${worker.head_branch ?? "(desconocida)"}, `
        + `no en la rama base de la PR (${pr.base})`);
    }
  }
  let lanzada = worker;
  if (esBot(worker.actor?.login)) {
    // El bucle lanza los workers con la identidad del harness. Solo hay un bucle por iniciativa a la
    // vez (su concurrency), así que el que lanzó este worker es el que estaba en marcha cuando empezó.
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(iniciativa ?? "")) {
      throw new Error(`La iniciativa «${iniciativa ?? ""}» no es válida`);
    }
    const inicio = Date.parse(worker.created_at);
    const { workflow_runs: bucles = [] } = await api(
      `repos/${repo}/actions/workflows/diverger-bucle.yml/runs?per_page=100&created=${encodeURIComponent(`<=${worker.created_at}`)}`);
    const candidatos = bucles.filter((b) => ruta(b.path) === WORKFLOW_BUCLE
      && b.display_title === `diverger-bucle ${iniciativa}`
      && Date.parse(b.run_started_at ?? b.created_at) <= inicio
      && (b.status !== "completed" || Date.parse(b.updated_at) >= inicio));
    if (candidatos.length !== 1) {
      throw new Error(candidatos.length
        ? `Hay ${candidatos.length} bucles de ${iniciativa} en marcha cuando empezó el worker ${ejecucion}`
        : `No se encuentra el bucle de ${iniciativa} que lanzó el worker ${ejecucion}`);
    }
    lanzada = candidatos[0];
  }
  const login = lanzada.actor?.login ?? "";
  if (!login || esBot(login)) {
    throw new Error(`La ejecución ${lanzada.id} la lanzó ${login || "nadie"}, que no es una persona`);
  }
  const persona = await api(`users/${encodeURIComponent(login)}`);
  return { login, id: persona.id, nombre: nombreSeguro(persona.name, login), ejecucion: lanzada.html_url };
}

/** Cliente mínimo de la API REST de GitHub con el token del job. */
export function apiDeGitHub(token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "",
  base = process.env.GITHUB_API_URL ?? "https://api.github.com") {
  return async (path) => {
    const respuesta = await fetch(`${base}/${path}`, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!respuesta.ok) throw new Error(`La API de GitHub responde ${respuesta.status} a ${path}`);
    return respuesta.json();
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [ejecucion, iniciativa] = process.argv.slice(2);
  const repo = process.env.GITHUB_REPOSITORY ?? "";
  if (!ejecucion || !repo) {
    console.error("Uso: GITHUB_REPOSITORY=<dueño>/<repo> node scripts/lanzador.mjs <id del job del worker> <iniciativa>");
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(await quienLanzo({ api: apiDeGitHub(), repo, ejecucion, iniciativa })));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
