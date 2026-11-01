// Worker de cada tarea (EN-EJE-02, contrato del ADR 0016 del harness): lo que se puede comprobar del
// workflow sin GitHub. Primero su forma (lanzamiento, permisos, topes, orden de los pasos) y después
// los pasos que no necesitan GitHub ni a Claude, ejecutados con bash sobre un repositorio de juguete.
// Los que usan jq se saltan donde no está (en el runner del CI sí está).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

const RAIZ = join(import.meta.dirname, "..", "..");
const TEXTO = readFileSync(join(RAIZ, ".github", "workflows", "diverger-worker.yml"), "utf8");
const SIN_COMENTARIOS = TEXTO.split("\n").filter((linea) => !linea.trimStart().startsWith("#")).join("\n");
const SCRIPT_MODELO = join(RAIZ, ".github", "diverger", "worker-modelo.sh");
const SCRIPT_COMPROBAR = join(RAIZ, ".github", "diverger", "worker-comprobar.sh");
const MODELO_SH = readFileSync(SCRIPT_MODELO, "utf8");

interface Paso {
  name?: string;
  "continue-on-error"?: boolean;
  uses?: string;
  id?: string;
  if?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, string | boolean>;
  "timeout-minutes"?: number;
  "working-directory"?: string;
}

const WF = parse(TEXTO) as {
  "run-name": string;
  on: { workflow_dispatch: { inputs: Record<string, { required: boolean; type: string }> } };
  permissions: Record<string, string>;
  jobs: Record<string, { permissions: Record<string, string>; "timeout-minutes": number; env: Record<string, string>; steps: Paso[] }>;
};
const JOB = WF.jobs.worker ?? { permissions: {}, "timeout-minutes": 0, env: {}, steps: [] };
const PASOS = JOB.steps;

function indice(nombre: string): number {
  const i = PASOS.findIndex((p) => p.name === nombre || p.id === nombre);
  expect(i, `falta el paso «${nombre}»`).toBeGreaterThanOrEqual(0);
  return i;
}

function paso(nombre: string): Paso {
  const p = PASOS[indice(nombre)];
  if (!p) throw new Error(`Falta el paso «${nombre}»`);
  return p;
}

describe("forma del workflow del worker", () => {
  it("se lanza solo con workflow_dispatch y las entradas initiative, task y run", () => {
    expect(Object.keys(WF.on)).toEqual(["workflow_dispatch"]);
    const entradas = WF.on.workflow_dispatch.inputs;
    expect(Object.keys(entradas)).toEqual(["initiative", "task", "run"]);
    for (const entrada of Object.values(entradas)) expect(entrada).toMatchObject({ required: true, type: "string" });
  });

  it("el job se llama diverger-worker <task> <run>, para encontrarlo al conciliar", () => {
    expect(WF["run-name"]).toBe("diverger-worker ${{ inputs.task }} ${{ inputs.run }}");
  });

  it("el token del job solo lee el contenido; id-token solo en el job, para la telemetría", () => {
    expect(WF.permissions).toEqual({ contents: "read" });
    expect(Object.keys(WF.jobs)).toEqual(["worker"]);
    expect(JOB.permissions).toEqual({ contents: "read", "id-token": "write" });
  });

  it("no tiene credenciales de despliegue: solo la clave de Anthropic, la de la App y la cuenta de telemetría", () => {
    const secretos = new Set([...TEXTO.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]));
    expect([...secretos].sort()).toEqual(["ANTHROPIC_API_KEY", "DIVERGER_HARNESS_APP_KEY"]);
    const variablesGcp = new Set([...SIN_COMENTARIOS.matchAll(/vars\.(GCP_[A-Z0-9_]+)/g)].map((m) => m[1]));
    expect([...variablesGcp].sort()).toEqual(["GCP_PROJECT_ID", "GCP_TELEMETRY_SA", "GCP_WIF_PROVIDER"]);
    expect(SIN_COMENTARIOS).not.toMatch(/GCP_DEPLOY_SA|GCP_RUN_SA|GCP_CLOUDDEPLOY|environment:|credentials_json|gcloud|setup-gcloud/);
    // La única cuenta que pide es la de telemetría.
    const auth = PASOS.filter((p) => p.uses?.startsWith("google-github-actions/"));
    expect(auth).toHaveLength(1);
    expect(auth[0]?.uses).toMatch(/^google-github-actions\/auth@[0-9a-f]{40}$/);
    expect(auth[0]?.with).toEqual({
      workload_identity_provider: "${{ vars.GCP_WIF_PROVIDER }}",
      service_account: "${{ vars.GCP_TELEMETRY_SA }}",
    });
  });

  it("el token de escritura de la App se pide después del worker y solo puede escribir contenido y PR", () => {
    const token = paso("token");
    expect(token.uses).toMatch(/^actions\/create-github-app-token@[0-9a-f]{40}$/);
    expect(indice("token")).toBeGreaterThan(indice("Comprobaciones, intento 3"));
    const permisos = Object.entries(token.with ?? {}).filter(([clave]) => clave.startsWith("permission-"));
    expect(Object.fromEntries(permisos)).toEqual({ "permission-contents": "write", "permission-pull-requests": "write" });
    expect(token.with?.repositories).toBe("${{ github.event.repository.name }}");
  });

  it("el plugin diverger-dev se descarga antes del worker con un token que solo lee el harness", () => {
    const token = paso("token-dev");
    expect(token.uses).toMatch(/^actions\/create-github-app-token@[0-9a-f]{40}$/);
    const permisos = Object.entries(token.with ?? {}).filter(([clave]) => clave.startsWith("permission-"));
    expect(Object.fromEntries(permisos)).toEqual({ "permission-contents": "read" });
    expect(token.with?.repositories).toBe("Diverger-ExP-Harness");
    const descarga = PASOS[indice("token-dev") + 1];
    expect(descarga?.uses).toMatch(/^actions\/checkout@[0-9a-f]{40}$/);
    expect(descarga?.with).toMatchObject({
      repository: "${{ github.repository_owner }}/Diverger-ExP-Harness",
      token: "${{ steps.token-dev.outputs.token }}",
      path: ".diverger-dev",
      "persist-credentials": false,
      "sparse-checkout": "plugins/diverger-dev",
    });
    expect(indice("token-dev")).toBeLessThan(indice("Worker"));
    // El token de lectura solo lo usa la descarga: ningún otro paso lo cita.
    expect(TEXTO.match(/steps\.token-dev\.outputs\.token/g)).toHaveLength(1);
  });

  it("el checkout no guarda credenciales en .git", () => {
    const checkout = PASOS.find((p) => p.uses?.startsWith("actions/checkout@"));
    expect(checkout?.with?.["persist-credentials"]).toBe(false);
  });

  it("el modelo solo recibe la clave de Anthropic, ningún token de GitHub", () => {
    for (const nombre of ["Worker", "Worker, intento 2", "Worker, intento 3"]) {
      expect(Object.keys(paso(nombre).env ?? {}).sort()).toEqual(["ANTHROPIC_API_KEY", "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"]);
      expect(paso(nombre).run).toMatch(/^bash "\$GITHUB_WORKSPACE\/\.github\/diverger\/worker-modelo\.sh" [123]$/);
    }
    for (const anterior of PASOS.slice(0, indice("Worker"))) {
      expect(JSON.stringify(anterior.env ?? {})).not.toMatch(/token|GH_TOKEN|GITHUB_TOKEN/i);
    }
  });

  it("las comprobaciones las ejecuta el job, sin la clave de Anthropic, y hay tres intentos como mucho", () => {
    const conClave = PASOS.filter((p) => JSON.stringify(p.env ?? {}).includes("ANTHROPIC_API_KEY")).map((p) => p.name);
    expect(conClave).toEqual(["Worker", "Worker, intento 2", "Worker, intento 3"]);
    for (const n of [1, 2, 3]) {
      const comprobaciones = paso(`comprobaciones-${n}`);
      expect(comprobaciones.env).toBeUndefined();
      expect(comprobaciones["continue-on-error"]).toBe(true);
      expect(comprobaciones.run).toBe(`bash .github/diverger/worker-comprobar.sh ${n}`);
      expect(indice(`comprobaciones-${n}`)).toBe(indice(n === 1 ? "Worker" : `Worker, intento ${n}`) + 1);
    }
    expect(paso("Worker, intento 2").if).toBe("steps.comprobaciones-1.outcome == 'failure'");
    expect(paso("comprobaciones-2").if).toBe("steps.comprobaciones-1.outcome == 'failure'");
    expect(paso("Worker, intento 3").if).toBe("steps.comprobaciones-2.outcome == 'failure'");
    expect(paso("comprobaciones-3").if).toBe("steps.comprobaciones-2.outcome == 'failure'");
    expect(PASOS.filter((p) => p.name?.startsWith("Worker"))).toHaveLength(3);
  });

  it("el worker corre en dontAsk, sin Bash y escribiendo solo src/, web/ y app/contextos.ts", () => {
    expect(MODELO_SH).toMatch(/--permission-mode dontAsk/);
    expect(MODELO_SH).toMatch(/--setting-sources user --strict-mcp-config/);
    expect(MODELO_SH).toMatch(/--plugin-dir "\$PLUGIN_DEV"/);
    expect(MODELO_SH).not.toMatch(/dangerously|bypassPermissions|acceptEdits/);
    // Sin Bash ni herramientas de red: el modelo no ejecuta nada y solo sale a la API de Anthropic.
    const herramientas = /--tools "([^"]+)"/.exec(MODELO_SH)?.[1]?.split(",");
    expect(herramientas).toEqual(["Read", "Glob", "Grep", "Edit", "Write", "Skill"]);
    const orden = MODELO_SH.slice(MODELO_SH.indexOf("claude -p"));
    const bloque = orden.slice(orden.indexOf("--allowedTools"), orden.indexOf("--setting-sources"));
    const permitidas = [...bloque.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(permitidas).toEqual(["Read", "Glob", "Grep", "Skill(diverger-dev:implement)",
      "Edit(./src/**)", "Write(./src/**)", "Edit(./web/**)", "Write(./web/**)",
      "Edit(./app/contextos.ts)", "Write(./app/contextos.ts)"]);
  });

  it("tiene topes de turnos, de gasto y de tiempo por intento", () => {
    expect(MODELO_SH).toMatch(/--max-turns "\$MAX_TURNOS"/);
    expect(MODELO_SH).toMatch(/--max-budget-usd "\$MAX_USD"/);
    expect(JOB.env.MAX_TURNOS).toBe("${{ vars.DIVERGER_WORKER_MAX_TURNS || '40' }}");
    expect(JOB.env.MAX_USD).toBe("${{ vars.DIVERGER_WORKER_MAX_BUDGET_USD || '2.00' }}");
    const pasosConTope = PASOS.filter((p) => p.name?.startsWith("Worker") || p.id?.startsWith("comprobaciones-"));
    const total = pasosConTope.reduce((suma, p) => suma + (p["timeout-minutes"] ?? Infinity), 0);
    expect(total).toBeLessThanOrEqual(3 * 35);
    expect(JOB["timeout-minutes"]).toBeLessThanOrEqual(60);
  });

  it("instala una versión fija de Claude Code y fija las acciones por su commit", () => {
    expect(TEXTO).toMatch(/npm install -g @anthropic-ai\/claude-code@\d+\.\d+\.\d+\n/);
    const usos = TEXTO.split("\n").filter((linea) => /^\s*(- )?uses:/.test(linea));
    expect(usos).toHaveLength(PASOS.filter((p) => p.uses).length);
    for (const linea of usos) expect(linea).toMatch(/@[0-9a-f]{40} # v\d/);
  });

  it("las entradas nunca se pegan en un script", () => {
    for (const p of PASOS) expect(p.run ?? "").not.toMatch(/\$\{\{\s*(inputs|github\.event)/);
  });

  it("la rama es diverger/<iniciativa>/<tarea> y la PR lleva la marca de la tarea y la ejecución", () => {
    expect(paso("Comprobar las entradas").run).toContain('echo "RAMA=diverger/$INICIATIVA/$TAREA"');
    const pr = paso("Rama y PR").run ?? "";
    expect(pr).toContain('echo "<!-- diverger:task=$TAREA;run=$EJECUCION -->"');
    expect(pr).toContain('--head "$RAMA"');
    expect(pr).toContain('--base "$GITHUB_REF_NAME"');
  });

  it("activa el auto-merge de su PR y, si no puede, avisa sin fallar (HU-GP-01)", () => {
    const pr = paso("Rama y PR").run ?? "";
    expect(pr).toContain('gh pr merge "$url" -R "$repo" --auto --merge --delete-branch');
    expect(pr).not.toMatch(/--admin/);
    expect(pr).toMatch(/if gh pr merge[^\n]*; then[\s\S]*::warning::No se ha podido activar el auto-merge/);
  });

  it("el commit lleva los trailers de autoría y no ejecuta hooks del repositorio", () => {
    const commit = paso("Commit con los trailers").run ?? "";
    for (const trailer of ["Diverger-Rol: Desarrollador", "Diverger-Modelo: $MODELO", "Diverger-Tarea: $TAREA", "Diverger-Iniciado-por: $LANZADO_POR"]) {
      expect(commit).toContain(`--trailer "${trailer}"`);
    }
    expect(commit).toContain("core.hooksPath=/dev/null");
    expect(paso("Rama y PR").run).toContain("core.hooksPath=/dev/null");
  });

  it("la telemetría solo corre si el repositorio la tiene configurada, y antes del worker", () => {
    expect(JOB.env.TELEMETRIA).toBe("${{ vars.GCP_WIF_PROVIDER != '' && vars.GCP_TELEMETRY_SA != '' }}");
    const auth = PASOS.findIndex((p) => p.uses?.startsWith("google-github-actions/auth@"));
    const pasos = [PASOS[auth], paso("Arrancar el Collector"), paso("Configuración gestionada")];
    for (const p of pasos) expect(p?.if).toBe("env.TELEMETRIA == 'true'");
    expect(auth).toBeLessThan(indice("Arrancar el Collector"));
    expect(indice("Arrancar el Collector")).toBeLessThan(indice("Configuración gestionada"));
    expect(indice("Configuración gestionada")).toBeLessThan(indice("Worker"));
  });

  it("el Collector usa la configuración del checkout y la imagen fija de Google", () => {
    expect(JOB.env.COLLECTOR_IMAGE).toMatch(/^us-docker\.pkg\.dev\/cloud-ops-agents-artifacts\/google-cloud-opentelemetry-collector\/otelcol-google:\d+\.\d+\.\d+$/);
    const arranque = paso("Arrancar el Collector").run ?? "";
    expect(arranque).toContain('-v "$PWD/.github/telemetria/collector.yaml:/etc/otelcol/config.yaml:ro"');
    expect(arranque).toContain("-p 4317:4317");
    expect(paso("Arrancar el Collector")["working-directory"]).toBeUndefined();
    expect(existsSync(join(RAIZ, ".github", "telemetria", "collector.yaml"))).toBe(true);
  });

  it("las variables del exportador van en la configuración gestionada, sin el texto de prompts ni respuestas", () => {
    const gestionada = paso("Configuración gestionada");
    expect(gestionada["working-directory"]).toBeUndefined();
    expect(gestionada.run).toContain("sudo tee /etc/claude-code/managed-settings.json");
    expect(gestionada.run).toContain(".github/telemetria/managed-settings.json");
    const ajustes = JSON.parse(readFileSync(join(RAIZ, ".github", "telemetria", "managed-settings.json"), "utf8")) as { env: Record<string, string> };
    expect(ajustes.env).toMatchObject({
      CLAUDE_CODE_ENABLE_TELEMETRY: "1",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4317",
      OTEL_LOG_USER_PROMPTS: "0",
      OTEL_LOG_ASSISTANT_RESPONSES: "0",
      OTEL_LOG_TOOL_DETAILS: "0",
    });
  });

  it("al modelo se le quitan las variables para pedir tokens de OIDC y las credenciales de GCP", () => {
    const quitar = MODELO_SH.indexOf("unset ACTIONS_ID_TOKEN_REQUEST_TOKEN ACTIONS_ID_TOKEN_REQUEST_URL GOOGLE_APPLICATION_CREDENTIALS");
    expect(quitar).toBeGreaterThanOrEqual(0);
    expect(quitar).toBeLessThan(MODELO_SH.indexOf("claude -p"));
    expect(MODELO_SH).toContain("CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE GOOGLE_GHA_CREDS_PATH");
  });

  it("para el Collector siempre, antes de eliminar el worktree", () => {
    expect(paso("Parar el Collector").if).toBe("always()");
    expect(paso("Parar el Collector").run).toContain("docker stop -t 30 otel");
    expect(indice("Parar el Collector")).toBeGreaterThan(indice("Rama y PR"));
    expect(indice("Parar el Collector")).toBeLessThan(indice("Eliminar el worktree"));
  });

  it("elimina el worktree y escribe el resumen siempre, al final", () => {
    const n = PASOS.length;
    expect(PASOS[n - 2]).toMatchObject({ name: "Eliminar el worktree", if: "always()" });
    expect(PASOS[n - 1]).toMatchObject({ name: "Resumen", if: "always()" });
  });
});

// Pasos ejecutados de verdad, como los ejecuta GitHub: bash -eo pipefail.
const HAY_BASH = spawnSync("bash", ["-c", "true"]).status === 0;
const HAY_JQ = HAY_BASH && spawnSync("bash", ["-c", "command -v jq"]).status === 0;

const TAREA_PENDIENTE = { schemaVersion: 1, id: "TA-001", title: "Tarea de prueba", status: "pending" };
const FICHERO = ".diverger/demo/tasks/TA-001.json";

let dir = "";
let repo = "";
let temp = "";
let entorno: Record<string, string> = {};

function git(...args: string[]): string {
  const r = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
}

function escribir(base: string, ruta: string, contenido: unknown): void {
  mkdirSync(join(base, dirname(ruta)), { recursive: true });
  writeFileSync(join(base, ruta), typeof contenido === "string" ? contenido : `${JSON.stringify(contenido, null, 2)}\n`);
}

function ejecutar(nombre: string, extra: Record<string, string> = {}): { codigo: number | null; salida: string; motivo: string } {
  const p = paso(nombre);
  const cwd = p["working-directory"] === "${{ env.WORKTREE }}" ? valor("WORKTREE") : repo;
  const r = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", p.run ?? ""], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...entorno, ...extra },
  });
  const motivo = existsSync(join(temp, "motivo")) ? readFileSync(join(temp, "motivo"), "utf8").trim() : "";
  return { codigo: r.status, salida: r.stdout + r.stderr, motivo };
}

/** Variables que el paso «Comprobar las entradas» deja en GITHUB_ENV. */
function cargarGithubEnv(): void {
  for (const linea of readFileSync(valor("GITHUB_ENV"), "utf8").split("\n").filter(Boolean)) {
    const i = linea.indexOf("=");
    entorno[linea.slice(0, i)] = linea.slice(i + 1);
  }
}

function valor(clave: string): string {
  const v = entorno[clave];
  if (v === undefined) throw new Error(`Falta ${clave} en el entorno de la prueba`);
  return v;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "worker-"));
  repo = join(dir, "repo");
  temp = join(dir, "temp");
  mkdirSync(repo);
  mkdirSync(temp);
  entorno = {
    INICIATIVA: "demo",
    TAREA: "TA-001",
    EJECUCION: "run-20261030-01",
    MODELO_VARIABLE: "",
    MODELO_POR_DEFECTO: "claude-sonnet-5-5",
    MAX_TURNOS: "40",
    MAX_USD: "2.00",
    HARNESS_REF: "main",
    GITHUB_WORKSPACE: dir,
    RUNNER_TEMP: temp,
    GITHUB_ENV: join(temp, "github_env"),
    GITHUB_STEP_SUMMARY: join(temp, "resumen.md"),
    GITHUB_REF_NAME: "main",
  };
  writeFileSync(valor("GITHUB_ENV"), "");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe.skipIf(!HAY_BASH)("comprobación de las entradas", () => {
  it("acepta entradas válidas y fija la rama, el fichero de la tarea y el worktree", () => {
    expect(ejecutar("Comprobar las entradas").codigo).toBe(0);
    cargarGithubEnv();
    expect(entorno.RAMA).toBe("diverger/demo/TA-001");
    expect(entorno.FICHERO_TAREA).toBe(FICHERO);
    expect(entorno.WORKTREE).toBe(`${temp}/worktree`);
    expect(entorno.PLUGIN_DEV).toBe(`${dir}/.diverger-dev/plugins/diverger-dev`);
  });

  it.each([
    [{ TAREA: "../TA-001" }, "La tarea «../TA-001» no es válida"],
    [{ TAREA: "TA-001.json" }, "La tarea «TA-001.json» no es válida"],
    [{ INICIATIVA: "Demo; rm -rf /" }, "La iniciativa «Demo; rm -rf /» no es válida"],
    [{ EJECUCION: "$(id)" }, "La ejecución «$(id)» no es válida"],
    [{ MAX_USD: "diez" }, "DIVERGER_WORKER_MAX_BUDGET_USD tiene que ser un importe en USD, como 0.50"],
    [{ MAX_TURNOS: "0" }, "DIVERGER_WORKER_MAX_TURNS tiene que ser un entero entre 1 y 999"],
    [{ HARNESS_REF: "main; id" }, "DIVERGER_HARNESS_REF no es válida"],
  ])("rechaza %o sin lanzar nada y deja el motivo para el resumen", (extra, motivo) => {
    const r = ejecutar("Comprobar las entradas", extra);
    expect(r.codigo).toBe(1);
    expect(r.motivo).toBe(motivo);
    expect(readFileSync(valor("GITHUB_ENV"), "utf8")).toBe("");
  });
});

describe.skipIf(!HAY_BASH)("worktree del worker", () => {
  beforeEach(() => {
    git("init", "-q", "-b", "main");
    escribir(repo, FICHERO, TAREA_PENDIENTE);
    git("add", "-A");
    git("-c", "user.name=prueba", "-c", "user.email=prueba@example.com", "commit", "-qm", "inicio");
    expect(ejecutar("Comprobar las entradas").codigo).toBe(0);
    cargarGithubEnv();
  });

  it("se crea en su rama y se elimina al cerrar el job", () => {
    expect(ejecutar("Crear el worktree").codigo).toBe(0);
    expect(existsSync(join(valor("WORKTREE"), FICHERO))).toBe(true);
    expect(git("worktree", "list")).toContain("[diverger/demo/TA-001]");
    escribir(valor("WORKTREE"), "pruebas/worker/TA-001.md", "sin guardar\n");

    const r = ejecutar("Eliminar el worktree");
    expect(r.codigo).toBe(0);
    expect(existsSync(valor("WORKTREE"))).toBe(false);
    expect(git("worktree", "list").trim().split("\n")).toHaveLength(1);
  });

  it("eliminarlo no falla si el job se cortó antes de crearlo", () => {
    expect(ejecutar("Eliminar el worktree").codigo).toBe(0);
  });

  describe.skipIf(!HAY_JQ)("con jq", () => {
    it("no lanza el worker si la tarea no existe o ya está hecha", () => {
      expect(ejecutar("Comprobar la tarea").codigo).toBe(0);
      expect(ejecutar("Comprobar la tarea", { FICHERO_TAREA: ".diverger/demo/tasks/TA-999.json" }).motivo)
        .toBe("No existe .diverger/demo/tasks/TA-999.json en main");
      escribir(repo, FICHERO, { ...TAREA_PENDIENTE, status: "done" });
      expect(ejecutar("Comprobar la tarea").motivo).toBe("La tarea TA-001 no está pendiente en main (status: done)");
    });

    it("no lanza el worker si una dependencia no está en el plan o no está hecha (EN-FM-02, criterio 3)", () => {
      escribir(repo, FICHERO, { ...TAREA_PENDIENTE, dependsOn: ["TA-009"] });
      expect(ejecutar("Comprobar la tarea").motivo).toBe("La tarea TA-001 depende de TA-009, que no está en el plan");
      escribir(repo, ".diverger/demo/tasks/TA-009.json", { ...TAREA_PENDIENTE, id: "TA-009" });
      expect(ejecutar("Comprobar la tarea").motivo).toBe("La tarea TA-001 depende de TA-009, que no está hecha");
      escribir(repo, ".diverger/demo/tasks/TA-009.json", { ...TAREA_PENDIENTE, id: "TA-009", status: "done" });
      expect(ejecutar("Comprobar la tarea").codigo).toBe(0);
    });

    it("el modelo del rol Desarrollador sale de settings.json, después de la variable y después del de por defecto", () => {
      expect(ejecutar("Comprobar la tarea").codigo).toBe(0);
      expect(readFileSync(valor("GITHUB_ENV"), "utf8")).toContain("MODELO=claude-sonnet-5-5\n");
      writeFileSync(valor("GITHUB_ENV"), "");
      expect(ejecutar("Comprobar la tarea", { MODELO_VARIABLE: "claude-haiku-5-5" }).codigo).toBe(0);
      expect(readFileSync(valor("GITHUB_ENV"), "utf8")).toContain("MODELO=claude-haiku-5-5\n");
      writeFileSync(valor("GITHUB_ENV"), "");
      escribir(repo, ".diverger/settings.json", { mode: "yolo", models: { developer: "claude-opus-5-5" } });
      expect(ejecutar("Comprobar la tarea", { MODELO_VARIABLE: "claude-haiku-5-5" }).codigo).toBe(0);
      expect(readFileSync(valor("GITHUB_ENV"), "utf8")).toContain("MODELO=claude-opus-5-5\n");
      escribir(repo, ".diverger/settings.json", { models: { developer: "$(id)" } });
      expect(ejecutar("Comprobar la tarea").motivo).toBe("El modelo del rol Desarrollador «$(id)» no es válido");
    });

    it("con las comprobaciones en verde, el job marca la tarea como hecha", () => {
      expect(ejecutar("Crear el worktree").codigo).toBe(0);
      writeFileSync(join(temp, "comprobaciones"), "verde\n");
      escribir(valor("WORKTREE"), "src/prestamos/index.ts", "export const x = 1;\n");
      const r = ejecutar("Comprobar el resultado");
      expect(r.motivo).toBe("");
      expect(r.codigo).toBe(0);
      expect(JSON.parse(readFileSync(join(valor("WORKTREE"), FICHERO), "utf8"))).toEqual({ ...TAREA_PENDIENTE, status: "done" });
    });

    it.each([
      ["con las comprobaciones en rojo", (wt: string) => {
        writeFileSync(join(temp, "comprobaciones"), "rojo\n");
        escribir(wt, "src/prestamos/index.ts", "x\n");
      }, "Las comprobaciones (npm run check) siguen en rojo después de 3 intentos"],
      ["sin cambios", () => {
        writeFileSync(join(temp, "comprobaciones"), "verde\n");
      }, "El worker no ha cambiado nada"],
      ["cambiando el plan", (wt: string) => {
        writeFileSync(join(temp, "comprobaciones"), "verde\n");
        escribir(wt, ".diverger/demo/tasks/TA-002.json", { ...TAREA_PENDIENTE, id: "TA-002", status: "done" });
      }, "El worker ha cambiado el plan: .diverger/demo/tasks/TA-002.json"],
      ["tocando los workflows", (wt: string) => {
        writeFileSync(join(temp, "comprobaciones"), "verde\n");
        escribir(wt, ".github/workflows/otro.yml", "on: push\n");
      }, "El worker ha cambiado .github/workflows/"],
    ])("rechaza el resultado %s", (_caso, cambio, motivo) => {
      expect(ejecutar("Crear el worktree").codigo).toBe(0);
      cambio(valor("WORKTREE"));
      const r = ejecutar("Comprobar el resultado");
      expect(r.codigo).toBe(1);
      expect(r.motivo).toBe(motivo);
    });

    it("el resumen dice por qué no hay PR, o enlaza la PR", () => {
      writeFileSync(join(temp, "motivo"), "El worker no ha cambiado nada\n");
      writeFileSync(join(temp, "salida-1.json"), JSON.stringify({
        subtype: "success", is_error: false, num_turns: 4, total_cost_usd: 0.01,
        permission_denials: [{ tool_name: "Bash", tool_use_id: "x", tool_input: { command: "curl -sI https://example.com" } }],
      }));
      expect(ejecutar("Resumen").codigo).toBe(0);
      const resumen = readFileSync(valor("GITHUB_STEP_SUMMARY"), "utf8");
      expect(resumen).toContain("**Resultado:** sin PR. El worker no ha cambiado nada");
      expect(resumen).toContain("Herramientas denegadas: 1\n- Bash");
      expect(resumen).toContain("en 1 intentos");

      writeFileSync(valor("GITHUB_STEP_SUMMARY"), "");
      writeFileSync(join(temp, "pr"), "https://github.com/o/r/pull/7\n");
      expect(ejecutar("Resumen").codigo).toBe(0);
      expect(readFileSync(valor("GITHUB_STEP_SUMMARY"), "utf8")).toContain("**Resultado:** PR abierta, https://github.com/o/r/pull/7");
    });
  });
});

// Los dos scripts del worker, con un claude y un npm de mentira en el PATH (EN-FM-02 y EN-EJE-03).
describe.skipIf(!HAY_JQ)("scripts del worker", () => {
  let bin = "";
  let worktree = "";

  function falso(nombre: string, cuerpo: string): void {
    writeFileSync(join(bin, nombre), `#!/usr/bin/env bash\n${cuerpo}\n`, { mode: 0o755 });
  }

  function script(ruta: string, intento: string, extra: Record<string, string> = {}) {
    const r = spawnSync("bash", [ruta, intento], {
      cwd: worktree,
      encoding: "utf8",
      env: { ...process.env, ...entorno, PATH: `${bin}:${process.env.PATH ?? ""}`, ...extra },
    });
    const motivo = existsSync(join(temp, "motivo")) ? readFileSync(join(temp, "motivo"), "utf8").trim() : "";
    return { codigo: r.status, salida: r.stdout + r.stderr, motivo };
  }

  beforeEach(() => {
    bin = join(dir, "bin");
    worktree = join(dir, "wt");
    mkdirSync(bin);
    mkdirSync(worktree);
    escribir(dir, ".diverger-dev/plugins/diverger-dev/.claude-plugin/plugin.json", { name: "diverger-dev" });
    entorno.PLUGIN_DEV = join(dir, ".diverger-dev", "plugins", "diverger-dev");
    entorno.WORKTREE = worktree;
    entorno.MODELO = "claude-sonnet-5-5";
    // claude de mentira: guarda sus argumentos y si ve la clave y el token de OIDC, y responde como -p.
    falso("claude", `printf '%s\\n' "$@" > "$RUNNER_TEMP/args-claude"
echo "clave=\${ANTHROPIC_API_KEY:-} oidc=\${ACTIONS_ID_TOKEN_REQUEST_TOKEN:-}" > "$RUNNER_TEMP/entorno-claude"
echo "{\\"subtype\\":\\"success\\",\\"is_error\\":false,\\"num_turns\\":3,\\"total_cost_usd\\":0.2,\\"session_id\\":\\"s-1\\",\\"result\\":\\"\${RESULTADO:-Hecho}\\"}"`);
  });

  it("el primer intento lanza la skill implement con el modelo del rol y sin el token de OIDC", () => {
    const r = script(SCRIPT_MODELO, "1", { ANTHROPIC_API_KEY: "sk-prueba", ACTIONS_ID_TOKEN_REQUEST_TOKEN: "oidc" });
    expect(r.motivo).toBe("");
    expect(r.codigo).toBe(0);
    const args = readFileSync(join(temp, "args-claude"), "utf8").split("\n");
    expect(args[1]).toBe("Usa la skill diverger-dev:implement para construir la tarea TA-001 de la iniciativa demo.");
    expect(args).not.toContain("--resume");
    expect(args[args.indexOf("--model") + 1]).toBe("claude-sonnet-5-5");
    expect(readFileSync(join(temp, "entorno-claude"), "utf8").trim()).toBe("clave=sk-prueba oidc=");
    expect(existsSync(join(temp, "salida-1.json"))).toBe(true);
  });

  it("el segundo intento sigue la misma sesión con el final de la salida de las comprobaciones", () => {
    writeFileSync(join(temp, "salida-1.json"), JSON.stringify({ session_id: "s-1" }));
    writeFileSync(join(temp, "comprobaciones-1.log"), "FAIL src/prestamos/prestamos.test.ts > presta dos veces\n");
    const r = script(SCRIPT_MODELO, "2");
    expect(r.codigo).toBe(0);
    const args = readFileSync(join(temp, "args-claude"), "utf8").split("\n");
    expect(args[args.indexOf("--resume") + 1]).toBe("s-1");
    expect(args[1]).toContain("Las comprobaciones del proyecto (npm run check) han fallado después de tu intento 1");
    expect(args.join("\n")).toContain("FAIL src/prestamos/prestamos.test.ts > presta dos veces");
  });

  it("si la skill se para con BLOQUEADA, el worker falla con su motivo", () => {
    const r = script(SCRIPT_MODELO, "1", { RESULTADO: "BLOQUEADA: hace falta cambiar spec/" });
    expect(r.codigo).toBe(1);
    expect(r.motivo).toBe("El worker se ha parado: BLOQUEADA: hace falta cambiar spec/");
  });

  it("sin el plugin descargado no lanza el modelo", () => {
    const r = script(SCRIPT_MODELO, "1", { PLUGIN_DEV: join(dir, "no-existe") });
    expect(r.codigo).toBe(1);
    expect(r.motivo).toBe(`No está el plugin diverger-dev en ${join(dir, "no-existe")}`);
    expect(existsSync(join(temp, "args-claude"))).toBe(false);
  });

  it("las comprobaciones corren sin la clave de Anthropic y dejan verde o rojo", () => {
    mkdirSync(join(worktree, "node_modules"));
    falso("npm", `echo "clave=\${ANTHROPIC_API_KEY:-} oidc=\${ACTIONS_ID_TOKEN_REQUEST_TOKEN:-}" > "$RUNNER_TEMP/entorno-npm"; exit \${CODIGO_NPM:-0}`);
    const verde = script(SCRIPT_COMPROBAR, "1", { ANTHROPIC_API_KEY: "sk-prueba", ACTIONS_ID_TOKEN_REQUEST_TOKEN: "oidc" });
    expect(verde.codigo).toBe(0);
    expect(readFileSync(join(temp, "comprobaciones"), "utf8").trim()).toBe("verde");
    expect(readFileSync(join(temp, "entorno-npm"), "utf8").trim()).toBe("clave= oidc=");

    const rojo = script(SCRIPT_COMPROBAR, "2", { CODIGO_NPM: "1" });
    expect(rojo.codigo).toBe(1);
    expect(readFileSync(join(temp, "comprobaciones"), "utf8").trim()).toBe("rojo");
    expect(existsSync(join(temp, "comprobaciones-2.log"))).toBe(true);
  });
});
