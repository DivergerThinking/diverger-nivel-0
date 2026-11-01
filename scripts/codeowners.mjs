// CODEOWNERS sigue protegiendo la configuración del harness (EN-OPS-04, ADR 0014 del harness).
// Uso en el CI: node scripts/codeowners.mjs [carpeta]. Falla si .diverger/settings.json o el propio
// CODEOWNERS se quedan sin propietario. Sigue las reglas de GitHub: busca el fichero en .github/, en
// la raíz y en docs/, por ese orden; gana la última regla que coincide; y una regla sin propietarios
// deja la ruta sin protección.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const UBICACIONES = [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"];
export const CONFIGURACION = ".diverger/settings.json";
const PROPIETARIO = /^(@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\/[A-Za-z0-9._-]+)?|[^@\s]+@[^@\s]+\.[^@\s]+)$/;

/** Patrón y propietarios de cada línea con regla, en orden. */
export function reglas(texto) {
  return texto.split(/\r?\n/).map((linea) => linea.split(" #")[0].trim())
    .filter((linea) => linea && !linea.startsWith("#"))
    .map((linea) => {
      const [patron = "", ...propietarios] = linea.split(/\s+/);
      return { patron, propietarios };
    });
}

function regex(patron) {
  let salida = "";
  for (let i = 0; i < patron.length;) {
    if (patron.startsWith("**/", i)) { salida += "(?:.*/)?"; i += 3; }
    else if (patron.startsWith("**", i)) { salida += ".*"; i += 2; }
    else if (patron[i] === "*") { salida += "[^/]*"; i += 1; }
    else if (patron[i] === "?") { salida += "[^/]"; i += 1; }
    else { salida += patron[i].replace(/[.+^${}()|[\]\\]/g, "\\$&"); i += 1; }
  }
  return salida;
}

const entera = (expresion, ruta) => new RegExp(`^(?:${expresion})$`).test(ruta);

/** Si un patrón de CODEOWNERS cubre una ruta de fichero, como lo interpreta GitHub. */
export function coincide(patron, ruta) {
  const cuerpo = patron.replace(/^\/+|\/+$/g, "");
  if (!cuerpo) return false;
  const prefijo = patron.startsWith("/") || cuerpo.includes("/") ? "" : "(?:.*/)?";
  // «docs/» cubre todo lo que hay dentro de cualquier carpeta docs, a cualquier profundidad.
  if (patron.endsWith("/")) return entera(`${prefijo}${regex(cuerpo)}/.*`, ruta);
  if (entera(prefijo + regex(cuerpo), ruta)) return true;
  // «/apps/github» cubre lo que hay dentro de esa carpeta; «docs/*» no cubre lo anidado.
  const ultimo = cuerpo.split("/").at(-1) ?? "";
  if (/[*?]/.test(ultimo)) return false;
  return entera(`${prefijo}${regex(cuerpo)}/.*`, ruta);
}

/** Propietarios de la última regla que cubre la ruta, o null si ninguna la cubre. */
export function propietarios(lista, ruta) {
  let resultado = null;
  for (const { patron, propietarios: duenos } of lista) if (coincide(patron, ruta)) resultado = duenos;
  return resultado;
}

/** Lo que impide que CODEOWNERS proteja la configuración, explicado para quien lo arregla. */
export function problemas(raiz = process.cwd()) {
  const fichero = UBICACIONES.find((ruta) => existsSync(join(raiz, ruta)));
  if (!fichero) return [`No hay CODEOWNERS (en ${UBICACIONES.join(", ")}): ${CONFIGURACION} queda sin propietario`];
  const lista = reglas(readFileSync(join(raiz, fichero), "utf8"));
  const errores = [];
  for (const { patron, propietarios: duenos } of lista) {
    if (patron.startsWith("!") || patron.includes("[")) errores.push(`${fichero}: GitHub no admite el patrón «${patron}» (ni «!» ni corchetes)`);
    for (const dueno of duenos) {
      if (!PROPIETARIO.test(dueno)) errores.push(`${fichero}: «${dueno}» no es un propietario válido (@usuario, @organización/equipo o correo)`);
    }
  }
  for (const ruta of [CONFIGURACION, fichero]) {
    const duenos = propietarios(lista, ruta);
    if (duenos === null) errores.push(`${fichero}: ninguna regla cubre ${ruta}; añade «/${ruta} @titular»`);
    else if (duenos.length === 0) errores.push(`${fichero}: la última regla que cubre ${ruta} no tiene propietarios y la deja sin protección`);
  }
  return errores;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const errores = problemas(process.argv[2] ?? process.cwd());
  for (const error of errores) console.error(error);
  process.exit(errores.length ? 1 : 0);
}
