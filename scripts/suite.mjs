// La PR de una tarea no toca la suite de aceptación (EN-CAL-01, RQ.021, ADR 0031 del harness).
// Uso en el CI: node scripts/suite.mjs <base>..<head>.
// La suite (tests/aceptacion/) es el examen de las historias: la escribe generate_features desde los criterios
// del backlog, antes que el código, y la cambia una persona. Una PR es de una tarea si alguno de sus commits
// lleva el trailer Diverger-Tarea, salvo en las ramas de mantenimiento del kit de evaluación del harness
// (diverger/reinicio/<número> y diverger/ajustes/<número>, harness#528), que no son tareas: el reinicio borra la
// suite de la evaluación anterior. La rama llega en PR_RAMA, y el worker rechaza esas dos iniciativas. Tampoco es
// de una tarea la PR del plan de una iniciativa, en plan/<iniciativa> (harness#696): la escribe un agente en la
// sesión de una persona, con los trailers, y trae la suite que generó generate_features. Tampoco la de la aplicación
// de un cambio integrado, en cambio/<iniciativa>/C-NNN (harness#35, ADR 0050): /diverger-architect:apply regenera el
// .feature de las historias construidas que cambia, y la PR la hace un agente en la sesión de una persona. Los workers
// nunca usan esas ramas: la suya es diverger/<iniciativa>/<tarea>.
// - Falla si la PR de una tarea cambia, añade, borra o renombra algo de la suite.
// - En cualquier PR que toque la suite, deja modificada=true en GITHUB_OUTPUT para que el job la etiquete
//   («suite-modificada»): así se cuenta cada modificación, sea de quien sea.
import { appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { commits, ramaDeMantenimiento } from "./trailers.mjs";

export const SUITE = "tests/aceptacion/";
export const ETIQUETA = "suite-modificada";

/** Ficheros de la suite que cambian entre la base y la cabeza de la PR (desde su ancestro común, sin renombrados). */
export function ficherosDeLaSuite(rango, cwd = process.cwd()) {
  const [base, cabeza] = rango.split("..");
  if (!base || !cabeza) throw new Error(`El rango «${rango}» no es <base>..<head>`);
  const salida = execFileSync("git", ["diff", "--name-only", "--no-renames", `${base}...${cabeza}`, "--", SUITE],
    { cwd, encoding: "utf8" });
  return salida.split("\n").map((linea) => linea.trim()).filter(Boolean);
}

/** La rama de la PR del plan de una iniciativa: plan/<iniciativa>, con el nombre en minúsculas y guiones. */
export function ramaDelPlan(rama) {
  return /^plan\/[a-z0-9]+(-[a-z0-9]+)*$/.test(rama ?? "");
}

/** La rama de la PR que aplica un cambio integrado: cambio/<iniciativa>/C-NNN, con tres cifras exactas (ADR 0050). */
export function ramaDelCambio(rama) {
  return /^cambio\/[a-z0-9]+(-[a-z0-9]+)*\/C-[0-9]{3}$/.test(rama ?? "");
}

/**
 * Tareas que nombran los commits (trailer Diverger-Tarea); ninguna en una rama de mantenimiento, en la del plan ni en
 * la de la aplicación de un cambio.
 */
export function tareas(lista, rama = "") {
  if (ramaDeMantenimiento(rama) || ramaDelPlan(rama) || ramaDelCambio(rama)) return [];
  const resultado = new Set();
  for (const commit of lista) {
    for (const tarea of (commit.tarea ?? "").split(",").map((t) => t.trim()).filter(Boolean)) resultado.add(tarea);
  }
  return [...resultado].sort();
}

/** Qué pasa con la PR: si toca la suite, si falla y el mensaje para quien la lee. */
export function veredicto(ficheros, tareasDeLaPR) {
  if (ficheros.length === 0) return { modificada: false, falla: false, mensaje: "La PR no toca la suite de aceptación." };
  const lista = ficheros.join(", ");
  if (tareasDeLaPR.length === 0) {
    return { modificada: true, falla: false,
      mensaje: `La PR modifica la suite de aceptación (${lista}). No es la PR de una tarea, así que la comprobación `
        + "pasa, pero CODEOWNERS pide la aprobación de un propietario y la modificación queda contada." };
  }
  return { modificada: true, falla: true,
    mensaje: `La PR de la tarea ${tareasDeLaPR.join(", ")} modifica la suite de aceptación: ${lista}. La suite es el `
      + "examen de las historias y la PR de una tarea no puede cambiarla. Si el código no cumple un escenario, cambia el "
      + "código; si el escenario está mal, una persona cambia los criterios de la historia en backlog.json y regenera "
      + "la suite con generate_features, en otra PR." };
}

export function comprobar(rango, rama = "", cwd = process.cwd()) {
  return veredicto(ficherosDeLaSuite(rango, cwd), tareas(commits(rango, cwd), rama));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const rango = process.argv[2] ?? "";
  let resultado;
  try {
    resultado = comprobar(rango, process.env.PR_RAMA ?? "");
  } catch (error) {
    console.error(`No se puede comprobar la suite de aceptación: ${error.message}`);
    process.exit(1);
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `modificada=${resultado.modificada}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Suite de aceptación\n\n${resultado.mensaje}\n`);
  }
  if (resultado.falla) {
    console.error(`::error::${resultado.mensaje}`);
    process.exit(1);
  }
  console.log(resultado.mensaje);
}
