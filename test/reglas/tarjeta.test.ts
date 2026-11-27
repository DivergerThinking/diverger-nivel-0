// Tarjetas del Project (HU-EJE-10, ADR 0063 del harness): el script que llama a tarjetas.py del núcleo desde el job del
// worker y desde diverger-tarjeta.yml, y la forma de ese workflow, que pasa la tarjeta a «Hecho» al integrarse la PR.
// Quien mueve la tarjeta es tarjetas.py, con sus tests en el harness; aquí se prueba que el job nunca falla por ella.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

const RAIZ = join(import.meta.dirname, "..", "..");
const SCRIPT = join(RAIZ, ".github", "diverger", "worker-tarjeta.sh");
const TEXTO = readFileSync(join(RAIZ, ".github", "workflows", "diverger-tarjeta.yml"), "utf8");

interface Paso {
  name?: string;
  id?: string;
  if?: string;
  uses?: string;
  run?: string;
  "continue-on-error"?: boolean;
  env?: Record<string, string>;
  with?: Record<string, string | boolean>;
}

const WF = parse(TEXTO) as {
  on: Record<string, { types: string[] }>;
  permissions: Record<string, string>;
  jobs: Record<string, { if: string; permissions: Record<string, string>; env: Record<string, string>; steps: Paso[] }>;
};
const JOB = WF.jobs.hecho ?? { if: "", permissions: {}, env: {}, steps: [] };

function paso(nombre: string): Paso {
  const p = JOB.steps.find((s) => s.name === nombre || s.id === nombre);
  if (!p) throw new Error(`Falta el paso «${nombre}»`);
  return p;
}

describe("forma de diverger-tarjeta.yml", () => {
  it("solo actúa sobre una PR integrada desde una rama diverger/ del mismo repositorio", () => {
    expect(Object.keys(WF.on)).toEqual(["pull_request"]);
    expect(WF.on.pull_request?.types).toEqual(["closed"]);
    expect(JOB.if).toContain("github.event.pull_request.merged == true");
    expect(JOB.if).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(JOB.if).toContain("startsWith(github.event.pull_request.head.ref, 'diverger/')");
    // El environment diverger-app solo admite main (harness#660): con otra rama base, GitHub no lanzaría el job y la
    // integración quedaría con un job en rojo. Se salta antes, como cualquier PR que no es de una tarea.
    expect(JOB.if).toContain("github.event.pull_request.base.ref == github.event.repository.default_branch");
  });

  it("sin permisos en el workflow y solo lectura del contenido en el job", () => {
    expect(WF.permissions).toEqual({});
    expect(JOB.permissions).toEqual({ contents: "read" });
  });

  it("no ejecuta código de la PR: la rama base y solo el script y los ajustes", () => {
    const checkout = JOB.steps.find((p) => p.uses?.startsWith("actions/checkout@") && !p.with?.repository);
    expect(checkout?.with).toEqual({
      ref: "${{ github.event.pull_request.base.ref }}",
      "persist-credentials": false,
      "sparse-checkout": ".diverger\n.github/diverger\n",
    });
    for (const p of JOB.steps) expect(p.run ?? "").not.toMatch(/\$\{\{\s*(inputs|github\.event)/);
  });

  it("los tokens de la App: uno que solo lee el núcleo y otro que solo escribe en los Projects", () => {
    const permisos = (p: Paso) => Object.fromEntries(Object.entries(p.with ?? {}).filter(([k]) => k.startsWith("permission-")));
    expect(permisos(paso("token-nucleo"))).toEqual({ "permission-contents": "read" });
    expect(paso("token-nucleo").with?.repositories).toBe("Diverger-ExP-Harness");
    expect(permisos(paso("token-tarjeta"))).toEqual({ "permission-issues": "read", "permission-organization-projects": "write" });
    expect(paso("token-tarjeta").with?.repositories).toBe("${{ github.event.repository.name }}");
    for (const p of JOB.steps.filter((s) => s.uses?.startsWith("actions/"))) expect(p.uses).toMatch(/@[0-9a-f]{40}/);
    expect(paso("Tarjeta a Hecho").env?.GH_TOKEN).toBe("${{ steps.token-tarjeta.outputs.token }}");
    expect(paso("Tarjeta a Hecho").run).toContain('bash "$GITHUB_WORKSPACE/.github/diverger/worker-tarjeta.sh" done');
  });

  it("sin la App o sin el núcleo, el job no falla", () => {
    for (const nombre of ["token-nucleo", "token-tarjeta"]) expect(paso(nombre)["continue-on-error"]).toBe(true);
    const descarga = JOB.steps.find((p) => p.with?.repository);
    expect(descarga?.["continue-on-error"]).toBe(true);
    expect(descarga?.with?.["sparse-checkout"]).toBe("plugins/diverger/server");
  });
});

const HAY_BASH = spawnSync("bash", ["-c", "true"]).status === 0;
const HAY_PYTHON = HAY_BASH && spawnSync("bash", ["-c", "python3 -c 'print(1)'"]).status === 0;

function rama(texto: string): { iniciativa?: string; tarea?: string; salida: string } {
  const run = paso("Tarea de la rama").run ?? "";
  const dir = mkdtempSync(join(tmpdir(), "rama-"));
  try {
    const salida = join(dir, "salida");
    writeFileSync(salida, "");
    const r = spawnSync("bash", ["-eo", "pipefail", "-c", run], {
      env: { ...process.env, RAMA: texto, HARNESS_REF: "main", GITHUB_OUTPUT: salida, GITHUB_STEP_SUMMARY: join(dir, "resumen") },
      encoding: "utf8",
    });
    expect(r.status, r.stderr).toBe(0);
    const valores = new Map<string, string>();
    for (const linea of readFileSync(salida, "utf8").split("\n").filter(Boolean)) {
      const [clave = "", valor = ""] = linea.split("=", 2);
      valores.set(clave, valor);
    }
    return { iniciativa: valores.get("iniciativa"), tarea: valores.get("tarea"), salida: r.stdout };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe.skipIf(!HAY_BASH)("tarea de la rama", () => {
  it("saca la iniciativa y la tarea de diverger/<iniciativa>/<tarea>", () => {
    expect(rama("diverger/padel/TA-004")).toMatchObject({ iniciativa: "padel", tarea: "TA-004" });
  });

  it("una rama que no es de una tarea no da tarea y lo dice", () => {
    for (const texto of ["diverger/reinicio/12", "diverger/ajustes/x", "diverger/padel/$(id)", "diverger/Padel/TA-1", "diverger/padel"]) {
      const r = rama(texto);
      expect(r.tarea, texto).toBeUndefined();
      expect(r.salida).toContain("no es la de una tarea");
    }
  });
});

describe.skipIf(!HAY_PYTHON)("worker-tarjeta.sh", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tarjeta-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function ejecutar(columna: string, env: Record<string, string>): { codigo: number | null; salida: string; registro: string } {
    const r = spawnSync("bash", [SCRIPT, columna], {
      env: { ...process.env, INICIATIVA: "padel", TAREA: "TA-004", GITHUB_REPOSITORY: "o/app", RUNNER_TEMP: dir, ...env },
      encoding: "utf8",
    });
    const fichero = join(dir, "tarjetas");
    const registro = existsSync(fichero) ? readFileSync(fichero, "utf8") : "";
    return { codigo: r.status, salida: r.stdout, registro };
  }

  it("llama a tarjetas.py con la tarea y la columna y anota su línea sin el prefijo", () => {
    const falso = join(dir, "tarjetas.py");
    writeFileSync(falso, "import sys\nprint('Diverger · Tarjeta de ' + sys.argv[sys.argv.index('--task') + 1] + ' movida a ' + sys.argv[sys.argv.index('--column') + 1])\n");
    const r = ejecutar("in-progress", { GH_TOKEN: "t", TARJETAS_PY: falso });
    expect(r.codigo).toBe(0);
    expect(r.registro).toBe("Tarjeta de TA-004 movida a in-progress\n");
  });

  it("sin token lo dice y termina bien", () => {
    const r = ejecutar("in-review", { GH_TOKEN: "", TARJETAS_PY: join(dir, "no.py") });
    expect(r.codigo).toBe(0);
    expect(r.registro).toContain("la tarjeta de TA-004 no se ha movido a En revisión");
    expect(r.registro).toContain("Projects: Read and write");
  });

  it("sin tarjetas.py en el núcleo lo dice y termina bien", () => {
    const r = ejecutar("done", { GH_TOKEN: "t", TARJETAS_PY: join(dir, "no.py") });
    expect(r.codigo).toBe(0);
    expect(r.registro).toContain("no tiene tarjetas.py");
  });

  it("si tarjetas.py falla, el script termina bien", () => {
    const falso = join(dir, "tarjetas.py");
    writeFileSync(falso, "import sys\nsys.exit(3)\n");
    const r = ejecutar("done", { GH_TOKEN: "t", TARJETAS_PY: falso });
    expect(r.codigo).toBe(0);
    expect(r.registro).toContain("no ha dicho nada");
  });

  it("una columna no válida no hace nada y termina bien", () => {
    const r = ejecutar("doing", { GH_TOKEN: "t" });
    expect(r.codigo).toBe(0);
    expect(r.registro).toBe("");
  });
});
