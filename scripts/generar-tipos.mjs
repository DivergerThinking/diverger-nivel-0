// Genera src/<id>/api.gen.ts desde el contrato OpenAPI de cada contexto (ADR 0003 del harness).
// Los tipos no se versionan: el contrato es la única fuente de los datos.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";
import { contratos } from "./contratos.mjs";

const lista = contratos();
for (const { id, contrato } of lista) {
  const ast = await openapiTS(pathToFileURL(contrato));
  const destino = join("src", id, "api.gen.ts");
  mkdirSync(join("src", id), { recursive: true });
  writeFileSync(destino, `// Generado desde ${contrato.replaceAll("\\", "/")} con npm run gen. No editar.\n\n${astToString(ast)}`);
  console.log(`${contrato} -> ${destino}`);
}
if (lista.length === 0) console.log("No hay contratos en spec/contextos/: nada que generar.");
