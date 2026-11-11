// La PR de una tarea solo marca su propia tarea como hecha (EN-EJE-04, RQ.017, ADR 0045 del harness).
// Uso en el CI: node scripts/tareas.mjs <base>..<head>.
// Cada tarea tiene su fichero, .diverger/<iniciativa>/tasks/<id>.json, y su PR lo pasa de pending a done. Con varios
// workers a la vez, el fichero propio evita que dos editen el mismo, pero no que uno marque una tarea ajena o reabra
// una integrada.
// Qué PR es de una tarea:
// - la de la rama de un worker, diverger/<iniciativa>/<tarea>, lleve o no trailers: la tarea es la de la rama, y un
//   trailer Diverger-Tarea con otra tarea falla;
// - en otra rama, la que lleva un trailer Diverger-Tarea con una tarea que tiene su fichero en la rama base. Un
//   trailer con una issue (harness#695), como el de las PR de mantenimiento hechas por un agente, no es una tarea;
// - no lo son las ramas de mantenimiento del kit de evaluación (diverger/reinicio/<número> y diverger/ajustes/<número>).
// La PR de una tarea falla si:
// - cambia, añade o borra el fichero de otra tarea;
// - no pasa el suyo de pending a done, o lo devuelve a pending;
// - cambia en su fichero algo más que status y failures (los fallos que corrigió, HU-NUC-20).
// La PR del plan de una iniciativa (plan/<iniciativa>) da de alta tareas: solo en pending, y no cambia el estado de una
// que ya existe ni borra una hecha.
// Los ficheros se comparan desde el ancestro común con la rama base: lo que cambió en la base después no es de la PR.
import { appendFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { ramaDelPlan } from "./suite.mjs";
import { commits, ramaDeMantenimiento, ramaDelWorker } from "./trailers.mjs";

/** Un fichero de tarea: .diverger/<iniciativa>/tasks/<id>.json. */
const FICHERO = /^\.diverger\/([^/]+)\/tasks\/([^/]+)\.json$/;

/** Los campos que la PR de una tarea puede cambiar en su fichero. */
export const CAMPOS = ["status", "failures"];

/** Lo que había en un fichero en un commit: el texto, o undefined si no existía. */
function leer(ref, ruta, cwd) {
  const r = spawnSync("git", ["show", `${ref}:${ruta}`], { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout : undefined;
}

/** El JSON de un fichero de tarea: el objeto, undefined si no existe o null si no es un objeto JSON. */
function json(texto) {
  if (texto === undefined) return undefined;
  try {
    const valor = JSON.parse(texto);
    return valor && typeof valor === "object" && !Array.isArray(valor) ? valor : null;
  } catch {
    return null;
  }
}

/**
 * Ficheros de tareas que cambia la PR, desde el ancestro común de la base y la cabeza, con su contenido antes y
 * después: { ruta, iniciativa, tarea, antes, despues }. antes y despues son el objeto, undefined si el fichero no
 * existe o null si no es un objeto JSON.
 */
function extremos(rango, cwd) {
  const [base, cabeza] = rango.split("..");
  if (!base || !cabeza) throw new Error(`El rango «${rango}» no es <base>..<head>`);
  const ancestro = execFileSync("git", ["merge-base", base, cabeza], { cwd, encoding: "utf8" }).trim();
  return { base, cabeza, ancestro };
}

/** Las tareas que tienen su fichero en la rama base, en el ancestro común o en su punta: { tarea: [iniciativas] }. */
export function tareasDeLaBase(rango, cwd = process.cwd()) {
  const { base, ancestro } = extremos(rango, cwd);
  const resultado = {};
  for (const ref of new Set([ancestro, base])) {
    const salida = execFileSync("git", ["ls-tree", "-r", "-z", "--name-only", ref, "--", ".diverger/"],
      { cwd, encoding: "utf8" });
    for (const ruta of salida.split("\0").filter(Boolean)) {
      const partes = FICHERO.exec(ruta);
      if (!partes) continue;
      const lista = (resultado[partes[2]] ??= []);
      if (!lista.includes(partes[1])) lista.push(partes[1]);
    }
  }
  return resultado;
}

export function cambiosDeTareas(rango, cwd = process.cwd()) {
  const { cabeza, ancestro } = extremos(rango, cwd);
  const salida = execFileSync("git", ["diff", "-z", "--name-only", "--no-renames", ancestro, cabeza, "--", ".diverger/"],
    { cwd, encoding: "utf8" });
  return salida.split("\0").filter(Boolean).flatMap((ruta) => {
    const partes = FICHERO.exec(ruta);
    if (!partes) return [];
    return [{ ruta, iniciativa: partes[1], tarea: partes[2], antes: json(leer(ancestro, ruta, cwd)),
      despues: json(leer(cabeza, ruta, cwd)) }];
  });
}

/** El valor en un texto que no depende del orden de las claves, para comparar dos campos. */
function canonico(valor) {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  if (valor && typeof valor === "object") {
    return `{${Object.keys(valor).sort().map((clave) => `${JSON.stringify(clave)}:${canonico(valor[clave])}`).join(",")}}`;
  }
  return JSON.stringify(valor);
}

/** Campos que cambian entre dos versiones del fichero de una tarea, salvo status y failures. */
function otrosCampos(antes, despues) {
  const claves = new Set([...Object.keys(antes), ...Object.keys(despues)]);
  return [...claves].filter((clave) => !CAMPOS.includes(clave) && canonico(antes[clave]) !== canonico(despues[clave]))
    .sort();
}

/** Las tareas que nombran los trailers Diverger-Tarea de los commits, sin repetir. */
function nombradas(lista) {
  const resultado = new Set();
  for (const commit of lista) {
    for (const tarea of (commit.tarea ?? "").split(",").map((t) => t.trim()).filter(Boolean)) resultado.add(tarea);
  }
  return [...resultado].sort();
}

/**
 * Qué PR es: { tipo: "tarea", tarea, iniciativas }, { tipo: "plan" }, { tipo: "ninguna" } o { tipo: "error", mensaje }.
 * `base` son las tareas con fichero en la rama base ({ tarea: [iniciativas] }).
 */
export function laPR(lista, rama, base) {
  if (ramaDeMantenimiento(rama)) return { tipo: "ninguna" };
  if (ramaDelPlan(rama)) return { tipo: "plan" };
  const enTrailers = nombradas(lista);
  const worker = ramaDelWorker(rama);
  if (worker) {
    const otras = enTrailers.filter((t) => t !== worker.tarea);
    if (otras.length) {
      return { tipo: "error", mensaje: `La rama ${rama} es de la tarea ${worker.tarea}, pero el trailer Diverger-Tarea `
        + `nombra ${otras.join(", ")}. La PR de una tarea es de una sola, y solo marca esa.` };
    }
    return { tipo: "tarea", tarea: worker.tarea, iniciativas: [worker.iniciativa] };
  }
  const delPlan = enTrailers.filter((t) => Object.hasOwn(base, t));
  if (delPlan.length === 0) return { tipo: "ninguna" };
  if (delPlan.length > 1) {
    return { tipo: "error", mensaje: `La PR nombra varias tareas en el trailer Diverger-Tarea (${delPlan.join(", ")}). `
      + "La PR de una tarea es de una sola, y solo marca esa." };
  }
  return { tipo: "tarea", tarea: delPlan[0], iniciativas: base[delPlan[0]] };
}

/** La PR del plan: altas en pending, sin cambiar el estado de una tarea que ya existe ni borrar una hecha. */
function veredictoDelPlan(cambios) {
  const errores = [];
  for (const { ruta, tarea, antes, despues } of cambios) {
    if (antes?.status === "done" && despues?.status !== "done") {
      errores.push(`Una tarea hecha no vuelve a pending: ${tarea}`);
    } else if (antes && despues && antes.status !== despues.status) {
      errores.push(`La PR del plan no cambia el estado de una tarea que ya existe: ${ruta} pasa de `
        + `${JSON.stringify(antes.status)} a ${JSON.stringify(despues.status)}.`);
    } else if (!antes && despues && despues.status !== "pending") {
      errores.push(`La PR del plan solo da de alta tareas en pending: ${ruta} está en ${JSON.stringify(despues.status)}.`);
    }
  }
  if (errores.length) return { falla: true, mensajes: errores };
  return { falla: false, mensajes: ["La PR del plan solo da de alta tareas en pending y no cambia el estado de las que ya existen."] };
}

/** Qué pasa con la PR: si falla y los mensajes para quien la lee. `pr` es lo que devuelve laPR. */
export function veredicto(cambios, pr) {
  if (pr.tipo === "ninguna") {
    return { falla: false, mensajes: ["No es la PR de una tarea: la comprobación de los ficheros de tareas no aplica."] };
  }
  if (pr.tipo === "error") return { falla: true, mensajes: [pr.mensaje] };
  if (pr.tipo === "plan") return veredictoDelPlan(cambios);
  const { tarea, iniciativas } = pr;
  const propio = `tasks/${tarea}.json`;
  const esPropio = (cambio) => cambio.tarea === tarea && iniciativas.includes(cambio.iniciativa);
  const propios = cambios.filter(esPropio);
  const errores = [];
  for (const cambio of cambios.filter((c) => !esPropio(c))) {
    errores.push(`El PR de ${tarea} solo puede cambiar ${propio}: también cambia ${cambio.ruta}.`);
    if (cambio.antes?.status === "done" && cambio.despues?.status !== "done") {
      errores.push(`Una tarea hecha no vuelve a pending: ${cambio.tarea}`);
    }
  }
  if (propios.length > 1) {
    errores.push(`El PR de ${tarea} solo puede cambiar un fichero de su tarea: cambia ${propios.map((c) => c.ruta).join(", ")}.`);
  } else if (propios.length === 0) {
    errores.push(`El PR de ${tarea} no marca su tarea como hecha: no cambia ${propio}.`);
  } else {
    const [{ ruta, antes, despues }] = propios;
    if (despues === undefined) {
      errores.push(`El PR de ${tarea} no marca su tarea como hecha: borra ${ruta}.`);
    } else if (despues === null) {
      errores.push(`El PR de ${tarea} no marca su tarea como hecha: ${ruta} no es un objeto JSON.`);
    } else if (antes?.status === "done" && despues.status !== "done") {
      errores.push(`Una tarea hecha no vuelve a pending: ${tarea}`);
    } else if (antes === undefined || antes === null) {
      errores.push(`El PR de ${tarea} solo puede marcar una tarea que ya está en la rama base: ${ruta} no existía `
        + "o no era un objeto JSON.");
    } else if (antes.status !== "pending") {
      errores.push(`El PR de ${tarea} solo puede pasar ${ruta} de pending a done: en la rama base estaba en `
        + `${JSON.stringify(antes.status)}.`);
    } else if (despues.status !== "done") {
      errores.push(`El PR de ${tarea} no marca su tarea como hecha: ${ruta} queda en ${JSON.stringify(despues.status)}.`);
    }
    if (antes && despues) {
      const otros = otrosCampos(antes, despues);
      if (otros.length) errores.push(`El PR de ${tarea} solo puede cambiar ${CAMPOS.join(" y ")} de ${ruta}: también cambia ${otros.join(", ")}.`);
    }
  }
  if (errores.length) return { falla: true, mensajes: errores };
  return { falla: false, mensajes: [`La PR de ${tarea} solo marca su tarea como hecha.`] };
}

export function comprobar(rango, rama = "", cwd = process.cwd()) {
  return veredicto(cambiosDeTareas(rango, cwd), laPR(commits(rango, cwd), rama, tareasDeLaBase(rango, cwd)));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const rango = process.argv[2] ?? "";
  let resultado;
  try {
    resultado = comprobar(rango, process.env.PR_RAMA ?? "");
  } catch (error) {
    console.error(`No se pueden comprobar los ficheros de tareas: ${error.message}`);
    process.exit(1);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## Ficheros de tareas\n\n${resultado.mensajes.map((m) => `- ${m}`).join("\n")}\n`);
  }
  if (resultado.falla) {
    for (const mensaje of resultado.mensajes) console.error(`::error::${mensaje}`);
    process.exit(1);
  }
  for (const mensaje of resultado.mensajes) console.log(mensaje);
}
