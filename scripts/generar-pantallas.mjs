// Genera web/pantallas.gen.ts, el registro de las pantallas de la aplicación, desde web/<id>/index.tsx (ADR 0053 del
// harness). Cada contexto con pantallas exporta las suyas desde su index.tsx, y la aplicación enseña todas las que
// encuentra. Así, dos tareas de contextos distintos no tocan ningún fichero en común y sus PR no tienen conflictos, como
// con el registro de los contextos (generar-contextos.mjs). El registro no se versiona: se regenera con npm run gen.
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const WEB = "web";
export const DESTINO = join(WEB, "pantallas.gen.ts");
/** El id de un contexto, como lo valida el arquitecto: también es el nombre de la carpeta de sus pantallas en web/. */
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * Los ids de los contextos con pantallas en `raiz`/web, ordenados: las carpetas con index.tsx. Falla con una carpeta con
 * index.tsx cuyo nombre no es un id de contexto, porque sus pantallas se quedarían fuera sin que nadie lo notara.
 */
export function contextosConPantallas(raiz = ".") {
  const carpeta = join(raiz, WEB);
  if (!existsSync(carpeta)) return [];
  const ids = readdirSync(carpeta, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory() && existsSync(join(carpeta, entrada.name, "index.tsx")))
    .map((entrada) => entrada.name);
  const malos = ids.filter((id) => !ID.test(id));
  if (malos.length) {
    throw new Error(`${malos.map((id) => `${WEB}/${id}`).join(", ")}: el nombre de la carpeta de unas pantallas es el id de `
      + "su contexto, en minúsculas, con números y guiones (como en spec/contextos/<id>/).");
  }
  return ids.sort();
}

/** El código del registro con las pantallas de los contextos `ids`, en ese orden. */
export function registro(ids) {
  const lineas = [
    `// Generado desde ${WEB}/<id>/index.tsx con npm run gen. No editar: las pantallas de un contexto se registran con su index.tsx.`,
    'import type { Pantalla } from "./pantallas.js";',
    ...ids.map((id, i) => `import { pantallas as pantallas${i} } from "./${id}/index.js";`),
    "",
    `export const pantallas: Pantalla[] = [${ids.map((_, i) => `...pantallas${i}`).join(", ")}];`,
    "",
  ];
  return lineas.join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  let ids;
  try {
    ids = contextosConPantallas();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  writeFileSync(DESTINO, registro(ids));
  console.log(`${DESTINO}: ${ids.length ? ids.join(", ") : "ninguna pantalla"}`);
}
