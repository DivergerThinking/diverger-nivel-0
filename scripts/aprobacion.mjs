// Política de aprobación «otra persona» (EN-OPS-10 y TA-172 del harness, RQ.067, ADR 0008 del harness): la PR del
// harness la aprueba una persona distinta de quien lo lanzó. El ruleset de esa política pide una aprobación y la de
// CODEOWNERS, pero GitHub deja que la dé quien lanzó el harness, porque la PR la abre la identidad del harness y no él.
// Quien lo lanzó es el Diverger-Iniciado-por de los commits del harness, que el job trailers ya compara con quien
// lanzó la ejecución (EN-OPS-06).
// Si la política es esa lo dicen las reglas de la rama base: el job solo comprueba algo cuando el ruleset exige el check
// otra-persona, que solo pone aplicar-politica.sh con esa política. Así no depende de .diverger/settings.json, que
// solo informa (revisión de la PR #63).
// Uso en el workflow aprobacion.yml: node scripts/aprobacion.mjs, con GH_TOKEN, GITHUB_REPOSITORY, PR_NUMERO y PR_BASE.
import { pathToFileURL } from "node:url";
import { apiDeGitHub, esBot } from "./lanzador.mjs";

export const MENSAJE = "La aprobación tiene que ser de una persona distinta de quien lanzó el harness";
export const CHECK = "otra-persona";
export const MAX_COMMITS = 250; // Lo más que devuelve la API de los commits de una PR.
const INICIADO_POR = /^Diverger-Iniciado-por:[ \t]*([A-Za-z0-9][A-Za-z0-9-]{0,38})[ \t]*$/gim;

const deApp = (usuario) => esBot(usuario?.login) || usuario?.type === "Bot";

/** Si las reglas de la rama exigen el check otra-persona. */
export function exigida(reglas) {
  return Array.isArray(reglas) && reglas.some((regla) => regla?.type === "required_status_checks"
    && (regla.parameters?.required_status_checks ?? []).some((check) => check?.context === CHECK));
}

/** Quiénes lanzaron el harness según el Diverger-Iniciado-por de los commits, en minúsculas. En una PR que abre una
 * GitHub App, solo cuentan los commits de la App: una persona con escritura podría reescribir la rama con commits
 * suyos que dijeran que la lanzó otra (revisión de la PR #63). */
export function lanzadores(commits, pr) {
  const logins = new Set();
  const soloDeLaApp = deApp(pr?.user);
  for (const commit of commits) {
    if (soloDeLaApp && !deApp(commit?.author)) continue;
    for (const coincidencia of String(commit?.commit?.message ?? "").matchAll(INICIADO_POR)) {
      logins.add(coincidencia[1].toLowerCase());
    }
  }
  return logins;
}

/** Las personas que hicieron algún commit de la PR, como autoras o con el push: su aprobación tampoco cuenta. */
export function autores(commits) {
  const logins = new Set();
  for (const commit of commits) {
    for (const usuario of [commit?.author, commit?.committer]) {
      if (usuario?.login && !deApp(usuario)) logins.add(String(usuario.login).toLowerCase());
    }
  }
  return logins;
}

// Solo cuenta quien tiene acceso al repositorio: en uno público, cualquiera puede dejar una aprobación.
const CON_ACCESO = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
// El permiso que hace falta para que la aprobación cuente, el mismo que pide GitHub a las revisiones obligatorias.
const PUEDE_APROBAR = new Set(["admin", "maintain", "write"]);

/** Quiénes tienen aprobado el último commit de la PR: la última revisión de cada persona que no sea un comentario, si
 * es una aprobación de ese commit y la persona tiene acceso al repositorio. Las cuentas de GitHub Apps no cuentan. */
export function aprobadores(revisiones, cabeza) {
  const ultima = new Map();
  for (const revision of revisiones) {
    const login = String(revision?.user?.login ?? "");
    if (!login || deApp(revision.user) || revision?.state === "COMMENTED") continue;
    ultima.set(login.toLowerCase(), revision);
  }
  return [...ultima].filter(([, revision]) => revision.state === "APPROVED" && revision.commit_id === cabeza
    && CON_ACCESO.has(revision.author_association)).map(([login]) => login);
}

/** Los que podrían aprobarla: aprobadores que no lanzaron el harness ni hicieron commits de la PR. */
export function candidatos({ pr, commits, revisiones }) {
  const excluidos = new Set([...lanzadores(commits, pr), ...autores(commits)]);
  return aprobadores(revisiones, pr?.head?.sha).filter((login) => !excluidos.has(login));
}

/** El veredicto: { ok, mensaje }. */
export function decidir({ reglas, pr, commits, revisiones, permisos = {} }) {
  if (!exigida(reglas)) {
    return { ok: true, mensaje: `Las reglas de la rama base no exigen ${CHECK}: no hay nada que comprobar` };
  }
  if ((pr?.commits ?? 0) > commits.length || commits.length >= MAX_COMMITS) {
    return { ok: false, mensaje: `No se pueden leer todos los commits de la PR (${pr?.commits ?? commits.length}): ${MENSAJE}` };
  }
  // El autor de un commit lo deduce GitHub del correo, que cualquiera puede poner: un commit sin autor reconocido en una
  // PR de la App no se sabe de quién es, y falla. Contra un commit con el correo de la App, el ruleset de esta política
  // pide además que otra persona apruebe el último push, que GitHub sí sabe quién lo hizo (revisión de seguridad).
  if (deApp(pr?.user) && commits.some((commit) => !commit?.author?.login)) {
    return { ok: false, mensaje: `Un commit de la PR no tiene autor reconocido en GitHub: ${MENSAJE}` };
  }
  const quienes = lanzadores(commits, pr);
  if (quienes.size === 0) {
    // La abre una GitHub App, como la identidad del harness, y no dice quién la lanzó: no se sabe a quién excluir.
    if (deApp(pr?.user)) {
      return { ok: false, mensaje: `La PR la abre ${pr.user.login} y ningún commit suyo dice quién lanzó el harness: ${MENSAJE}` };
    }
    return { ok: true, mensaje: "La PR no tiene commits del harness: no hay nada que comprobar" };
  }
  // author_association no basta: un miembro de la organización puede no tener escritura en este repositorio.
  const otros = candidatos({ pr, commits, revisiones }).filter((login) => PUEDE_APROBAR.has(permisos[login]));
  if (otros.length) {
    return { ok: true, mensaje: `Aprobada por ${otros.map((l) => `@${l}`).join(", ")}, distinta de quien lanzó el harness`
      + ` (${[...quienes].map((l) => `@${l}`).join(", ")})` };
  }
  return { ok: false, mensaje: MENSAJE };
}

/** Todas las páginas de una lista de la API. Si llega al tope, falla: con la lista cortada, una revisión posterior que
 * retira una aprobación se perdería. */
async function todas(api, ruta, tope) {
  const elementos = [];
  for (let pagina = 1; pagina <= tope; pagina++) {
    const lote = await api(`${ruta}?per_page=100&page=${pagina}`);
    if (!Array.isArray(lote)) throw new Error(`La API de GitHub no devuelve una lista en ${ruta}`);
    elementos.push(...lote);
    if (lote.length < 100) return elementos;
  }
  throw new Error(`${ruta} tiene más de ${tope * 100} elementos: no se pueden leer todos`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const repo = process.env.GITHUB_REPOSITORY ?? "";
  const numero = process.env.PR_NUMERO ?? "";
  const base = process.env.PR_BASE ?? "";
  if (!repo || !/^[0-9]+$/.test(numero) || !base) {
    console.error("Uso: GITHUB_REPOSITORY=<dueño>/<repo> PR_NUMERO=<n> PR_BASE=<rama> node scripts/aprobacion.mjs");
    process.exit(2);
  }
  try {
    const api = apiDeGitHub();
    const reglas = await api(`repos/${repo}/rules/branches/${encodeURIComponent(base)}`);
    let pr;
    let commits = [];
    let revisiones = [];
    const permisos = {};
    if (exigida(reglas)) {
      // Los commits, hasta 300: con más, decidir falla porque no son todos.
      [pr, commits, revisiones] = await Promise.all([api(`repos/${repo}/pulls/${numero}`),
        todas(api, `repos/${repo}/pulls/${numero}/commits`, 3).catch(() => []),
        todas(api, `repos/${repo}/pulls/${numero}/reviews`, 10)]);
      // El permiso de cada posible aprobador: si no se puede leer, no cuenta.
      for (const login of candidatos({ pr, commits, revisiones })) {
        try {
          permisos[login] = (await api(`repos/${repo}/collaborators/${encodeURIComponent(login)}/permission`))?.permission;
        } catch {
          permisos[login] = undefined;
        }
      }
    }
    const { ok, mensaje } = decidir({ reglas, pr, commits, revisiones, permisos });
    if (ok) console.log(mensaje);
    else console.error(`::error::${mensaje}`);
    process.exit(ok ? 0 : 1);
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
