// La PR de cada tarea cierra su subissue (harness EN-EJE-05, ADR 0061 del harness): el job del worker escribe
// «Closes #n» con la subissue de la tarea, que sale de providers.github.items de backlog.json, y solo si ese backlog se
// publicó en este repositorio. Sin subissue, la PR no lleva ningún «Closes».
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

const RAIZ = join(import.meta.dirname, "..", "..");
const WF = parse(readFileSync(join(RAIZ, ".github", "workflows", "diverger-worker.yml"), "utf8")) as {
  jobs: { worker: { steps: { name?: string; run?: string }[] } };
};
const PASO = WF.jobs.worker.steps.find((p) => p.name === "Rama y PR")?.run ?? "";
const HAY_JQ = spawnSync("bash", ["-c", "command -v jq"]).status === 0;

// Las líneas del paso que calculan la subissue y las que la escriben en la PR.
const lineas = PASO.split("\n");
const desde = lineas.findIndex((l) => l.trim().startsWith("subissue=$(jq"));
const hasta = lineas.findIndex((l, i) => i > desde && l.includes("|| true)"));
const CALCULO = lineas.slice(desde, hasta + 1).join("\n");
const ESCRITURA = 'if [[ "$subissue" =~ ^[1-9][0-9]{0,9}$ ]]; then';

let carpeta = "";
afterEach(() => {
  if (carpeta) rmSync(carpeta, { recursive: true, force: true });
});

function closes(backlog: object | string | null, repo = "acme/prestamos"): string {
  carpeta = mkdtempSync(join(tmpdir(), "subissue-"));
  mkdirSync(join(carpeta, ".diverger", "padel"), { recursive: true });
  if (backlog !== null) {
    writeFileSync(join(carpeta, ".diverger", "padel", "backlog.json"), typeof backlog === "string" ? backlog : JSON.stringify(backlog));
  }
  const guion = `${CALCULO}\n${ESCRITURA}\n echo "Closes #$subissue"\nfi`;
  const r = spawnSync("bash", ["-c", guion], {
    cwd: carpeta, encoding: "utf8", env: { ...process.env, repo, TAREA: "HU-SOL-02-prestamos", INICIATIVA: "padel" },
  });
  expect(r.status, r.stderr).toBe(0);
  return r.stdout.trim();
}

const publicado = (items: object, repo = "prestamos") => ({ providers: { github: { owner: "acme", repo, items } } });

describe("la PR del job del worker cierra la subissue de su tarea", () => {
  it("escribe «Closes #n» tras «Lanzado por», con el cálculo antes de la descripción", () => {
    expect(desde).toBeGreaterThan(-1);
    expect(hasta).toBeGreaterThan(desde);
    expect(PASO).toContain(ESCRITURA);
    expect(PASO.indexOf(ESCRITURA)).toBeGreaterThan(PASO.indexOf("Lanzado por @$LANZADO_POR"));
    expect(PASO.indexOf("subissue=$(jq")).toBeLessThan(PASO.indexOf('} > "$RUNNER_TEMP/pr.md"'));
  });
});

describe.skipIf(!HAY_JQ)("el número de la subissue", () => {
  it("la tarea con su subissue #42: la PR la cierra", () => {
    expect(closes(publicado({ "HU-SOL-02-prestamos": { number: 42 }, "HU-SOL-02": { number: 12 } }))).toBe("Closes #42");
    expect(closes(publicado({ "HU-SOL-02-prestamos": { number: 42 } }), "Acme/Prestamos")).toBe("Closes #42");
  });

  it("sin subissue no cierra nada: destino local, plan sin publicar o sin backlog", () => {
    expect(closes(null)).toBe("");
    expect(closes({ schemaVersion: 1 })).toBe("");
    expect(closes(publicado({ "HU-SOL-02": { number: 12 } }))).toBe("");
    expect(closes("{ no es json")).toBe("");
  });

  it("un backlog publicado en otro repositorio no cierra nada", () => {
    expect(closes(publicado({ "HU-SOL-02-prestamos": { number: 42 } }, "otro"))).toBe("");
  });

  it("un número que no es un entero positivo no se escribe", () => {
    for (const number of ["42; rm -rf /", 0, -3, "", true, 4.2]) {
      expect(closes(publicado({ "HU-SOL-02-prestamos": { number } }))).toBe("");
    }
  });
});
