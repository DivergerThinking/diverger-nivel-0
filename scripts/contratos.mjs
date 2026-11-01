// Contratos OpenAPI de los contextos: spec/contextos/<id>/api.openapi.json.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const SPEC_DIR = join("spec", "contextos");

/** Lista [{ id, contrato }] de los contextos que tienen contrato, ordenada por id. */
export function contratos() {
  if (!existsSync(SPEC_DIR)) return [];
  return readdirSync(SPEC_DIR, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => ({ id: entrada.name, contrato: join(SPEC_DIR, entrada.name, "api.openapi.json") }))
    .filter(({ contrato }) => existsSync(contrato))
    .sort((a, b) => a.id.localeCompare(b.id));
}
