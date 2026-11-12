// Genera app/contextos.gen.ts, el registro de los contextos de la aplicación, desde src/<id>/index.ts (golden-path#71).
// Cada contexto aporta sus rutas desde su index.ts, y el servidor registra todos los que encuentra. Así, dos tareas de
// contextos distintos no tocan ningún fichero en común y sus PR no tienen conflictos. El registro no se versiona: se
// regenera con npm run gen, como los tipos de los contratos.
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const SRC = "src";
export const DESTINO = join("app", "contextos.gen.ts");
/** El id de un contexto, como lo valida el arquitecto: también es el nombre de su carpeta en src/. */
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * Los ids de los contextos de `raiz`/src, ordenados: las carpetas con index.ts. Falla con una carpeta con index.ts cuyo
 * nombre no es un id de contexto, porque su contexto se quedaría sin registrar sin que nadie lo notara.
 */
export function contextos(raiz = ".") {
  const carpeta = join(raiz, SRC);
  if (!existsSync(carpeta)) return [];
  const ids = readdirSync(carpeta, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory() && existsSync(join(carpeta, entrada.name, "index.ts")))
    .map((entrada) => entrada.name);
  const malos = ids.filter((id) => !ID.test(id));
  if (malos.length) {
    throw new Error(`${malos.map((id) => `${SRC}/${id}`).join(", ")}: el nombre de la carpeta de un contexto es su id, `
      + "en minúsculas, con números y guiones (como en spec/contextos/<id>/).");
  }
  return ids.sort();
}

/** El código del registro con los contextos `ids`. */
export function registro(ids) {
  const lineas = [
    `// Generado desde ${SRC}/<id>/index.ts con npm run gen. No editar: un contexto se registra con su index.ts.`,
    "// Cada contexto recibe en sus opciones el almacén de datos (lib/datos.ts): es su única vía a la base.",
    'import type { FastifyPluginAsync } from "fastify";',
    'import type { OpcionesContexto } from "../lib/datos.js";',
    ...ids.map((id, i) => `import { rutas as contexto${i} } from "../${SRC}/${id}/index.js";`),
    "",
    `export const contextos: FastifyPluginAsync<OpcionesContexto>[] = [${ids.map((_, i) => `contexto${i}`).join(", ")}];`,
    "",
  ];
  return lineas.join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  let ids;
  try {
    ids = contextos();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  writeFileSync(DESTINO, registro(ids));
  console.log(`${DESTINO}: ${ids.length ? ids.join(", ") : "ningún contexto"}`);
}
