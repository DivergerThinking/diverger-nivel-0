// Bucle desatendido (HU-EJE-01, ADR 0016 del harness): lo que se puede comprobar del workflow sin
// GitHub. Que se lanza a mano, descarga el núcleo con un token de solo lectura, lanza los workers con
// el GITHUB_TOKEN del job, limitado a Actions, issues y lectura, no ejecuta ningún modelo y, de GCP, solo usa la cuenta de
// telemetría al terminar para registrar el resultado (EN-TEL-02, ADR 0017 del harness).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const RAIZ = join(import.meta.dirname, "..", "..");
const TEXTO = readFileSync(join(RAIZ, ".github", "workflows", "diverger-bucle.yml"), "utf8");
const SIN_COMENTARIOS = TEXTO.split("\n").filter((linea) => !linea.trimStart().startsWith("#")).join("\n");
// El job «analisis» (HU-EJE-11, ADR 0078 del harness) sí lanza un modelo, aparte del bucle: lo que se dice aquí del
// bucle vale para su job, el texto hasta el del análisis.
const INICIO_ANALISIS = SIN_COMENTARIOS.indexOf("\n  analisis:\n");
const BUCLE = INICIO_ANALISIS > 0 ? SIN_COMENTARIOS.slice(0, INICIO_ANALISIS) : SIN_COMENTARIOS;
// La comprobación previa (EN-GP-04) es el único paso del bucle que recibe el secreto de Anthropic y la variable de la
// cuenta de despliegue, solo para ver que no están vacíos: el resto del job no los nombra.
const PREVIA = "Comprobación previa del secreto y las variables";
const INICIO_PREVIA = BUCLE.indexOf(`      - name: ${PREVIA}\n`);
const SIN_PREVIA = BUCLE.slice(0, INICIO_PREVIA) + BUCLE.slice(BUCLE.indexOf("\n      - ", INICIO_PREVIA + 1));

// El único environment que puede tener: diverger-app, el de la clave de la App (harness#660). No es el de staging, el
// único que acepta la cuenta de despliegue.
const ENTORNO_APP = "    environment:\n      name: diverger-app\n      deployment: false\n";

interface Paso {
  name?: string;
  id?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, string | boolean>;
  "continue-on-error"?: boolean;
}

const WF = parse(TEXTO) as {
  "run-name": string;
  on: { workflow_dispatch: { inputs: Record<string, { required: boolean; type: string; default?: unknown }> } };
  permissions: Record<string, string>;
  concurrency: { group: string; "cancel-in-progress": boolean };
  jobs: Record<string, { permissions?: Record<string, string>; env: Record<string, string>; steps: Paso[];
    needs?: string; if?: string; outputs?: Record<string, string> }>;
};
const JOB = WF.jobs.bucle ?? { env: {}, steps: [] };
const PASOS = JOB.steps;

function paso(nombre: string): Paso {
  const p = PASOS.find((x) => x.name === nombre || x.id === nombre);
  if (!p) throw new Error(`Falta el paso «${nombre}»`);
  return p;
}

describe("workflow del bucle desatendido", () => {
  it("se lanza a mano con la iniciativa, los workers a la vez y el reinicio", () => {
    expect(Object.keys(WF.on)).toEqual(["workflow_dispatch"]);
    const entradas = WF.on.workflow_dispatch.inputs;
    expect(Object.keys(entradas)).toEqual(["initiative", "max-workers", "restart", "lanzado-por", "ejecucion"]);
    expect(entradas.initiative).toMatchObject({ required: true, type: "string" });
    expect(WF["run-name"]).toBe("diverger-bucle ${{ inputs.initiative }}");
  });

  it("sin max-workers, los workers de código son los de maxCodeWorkers del proyecto (harness#695, ADR 0035)", () => {
    // Con «1» por defecto, el bucle lanzado desde launch_unattended, que solo pasa la iniciativa, iba con un worker.
    expect(WF.on.workflow_dispatch.inputs["max-workers"]?.default).toBe("");
    const validar = paso("Validar las entradas").run ?? "";
    expect(validar).toContain('[[ -z "$MAX_WORKERS" || "$MAX_WORKERS" =~ ^[1-3]$ ]]');
    const bucle = paso("Bucle").run ?? "";
    expect(bucle).toContain('[ -n "$MAX_WORKERS" ] && opciones+=(--max-workers "$MAX_WORKERS")');
    expect(bucle).not.toContain('--max-workers "$MAX_WORKERS" --project');
  });

  it("sigue con el identificador de la ejecución de la sesión, el del nombre de su Project (harness HU-GP-06)", () => {
    expect(WF.on.workflow_dispatch.inputs.ejecucion).toMatchObject({ required: false, type: "string", default: "" });
    const validar = paso("Validar las entradas").run ?? "";
    expect(validar).toContain('[[ -z "$EJECUCION" || "$EJECUCION" =~ ^[0-9a-f]{8}$ ]]');
    const bucle = paso("Bucle").run ?? "";
    expect(bucle).toContain('[ -n "$EJECUCION" ] && opciones+=(--run-id "$EJECUCION")');
  });

  it("un solo bucle por iniciativa, sin cancelar el que está en marcha", () => {
    expect(WF.concurrency).toEqual({ group: "diverger-bucle-${{ inputs.initiative }}", "cancel-in-progress": false });
  });

  it("el token del job solo escribe en Actions, issues y PR, sin tocar el contenido, y GCP solo con la cuenta de telemetría", () => {
    expect(WF.permissions).toEqual({ contents: "read" });
    // Actions, issues y PR, para el GITHUB_TOKEN con el que el bucle lanza los workers (harness#753). En las PR escribe
    // para cerrar la de una tarea con conflictos (harness#770); sin contents: write no puede empujar a ninguna rama.
    expect(JOB.permissions).toEqual({ contents: "read", "id-token": "write", actions: "write", issues: "write",
      "pull-requests": "write" });
    expect(INICIO_PREVIA).toBeGreaterThan(0);
    expect(SIN_PREVIA).toContain(ENTORNO_APP);
    expect(SIN_PREVIA.replace(ENTORNO_APP, "")).not.toMatch(/GCP_DEPLOY_SA|environment:/);
    const auth = PASOS.filter((p) => p.uses?.startsWith("google-github-actions/auth@") && p.id !== "previa-gcp");
    // Uno para el arranque y otro al terminar: el bucle puede durar más que el token (harness#536).
    expect(auth).toHaveLength(2);
    for (const paso of auth) {
      expect(paso.with).toEqual({ workload_identity_provider: "${{ vars.GCP_WIF_PROVIDER }}",
        service_account: "${{ vars.GCP_TELEMETRY_SA }}" });
    }
  });

  it("registra el resultado después del bucle, sin fallar el job si no puede", () => {
    const nombres = PASOS.map((p) => p.name ?? p.uses ?? "");
    const bucle = nombres.indexOf("Bucle");
    const auth = nombres.findLastIndex((n) => n.startsWith("google-github-actions/auth@"));
    const registro = nombres.indexOf("Registrar el resultado");
    expect(bucle).toBeLessThan(auth);
    expect(auth).toBeLessThan(registro);
    expect(paso("Bucle").run).toContain('--results "$RUNNER_TEMP/resultados.jsonl"');
    const registrar = PASOS[registro] as Paso & { if?: string; "continue-on-error"?: boolean };
    expect(registrar.if).toBe("always() && env.TELEMETRIA == 'true' && steps.estado.outcome == 'success'");
    expect(registrar["continue-on-error"]).toBe(true);
    expect(registrar.run).toContain("gcloud logging write diverger-ejecucion \"$linea\" --payload-type=json");
    // gcloud solo escribe ese log: nada de despliegues ni de lecturas de GCP.
    expect(BUCLE.match(/gcloud [a-z-]+ [a-z-]+/g)).toEqual(["gcloud logging write"]);
  });

  it("registra el arranque solo si consiguió el token de GCP (harness#536)", () => {
    const nombres = PASOS.map((p) => p.name ?? p.uses ?? "");
    expect(nombres.findIndex((n) => n.startsWith("google-github-actions/auth@"))).toBeLessThan(nombres.indexOf("Bucle"));
    expect(paso("Bucle").run).toContain('[ "$GCP_ARRANQUE" = "success" ] && opciones+=(--log-project "$GCP_PROJECT_ID")');
  });

  it("no ejecuta ningún modelo", () => {
    expect(SIN_PREVIA).not.toMatch(/claude|ANTHROPIC_API_KEY|anthropic/i);
    expect(paso(PREVIA).run).toBe("bash .github/diverger/bucle-previa.sh secreto-y-variables");
  });

  it("valida las entradas antes de usarlas y nunca las pega en un script", () => {
    expect(PASOS[0]?.name).toBe("Validar las entradas");
    for (const p of PASOS) expect(p.run ?? "").not.toContain("${{");
  });

  it("descarga el núcleo con un token de la App de solo lectura y sin dejar credenciales", () => {
    const token = paso("token-nucleo");
    expect(token.with).toMatchObject({ repositories: "Diverger-ExP-Harness", "permission-contents": "read" });
    expect(Object.keys(token.with ?? {}).filter((k) => k.startsWith("permission-"))).toEqual(["permission-contents"]);
    const checkout = PASOS.find((p) => p.with?.repository !== undefined);
    expect(checkout?.with).toMatchObject({ token: "${{ steps.token-nucleo.outputs.token }}", "persist-credentials": false,
      "sparse-checkout": "plugins/diverger/server" });
  });

  it("lanza los workers con el GITHUB_TOKEN del job, que dura lo que el job, y no con un token de la App (harness#753)", () => {
    // El token de instalación de una GitHub App caduca a la hora, y el bucle dura hasta 350 minutos: la sexta ejecución
    // del nivel 1 se paró con «HTTP 401: Bad credentials» a los 61 minutos. Ningún paso del bucle puede usar un token de
    // la App, salvo el que descarga el núcleo al principio.
    const tokensDeLaApp = PASOS.filter((p) => p.uses?.startsWith("actions/create-github-app-token@"));
    expect(tokensDeLaApp.map((p) => p.id)).toEqual(["token-nucleo"]);
    expect(paso("Recuperar el estado anterior").env).toEqual({ GH_TOKEN: "${{ github.token }}" });
    expect(paso("Bucle").env).toEqual({ GH_TOKEN: "${{ github.token }}",
      GCP_ARRANQUE: "${{ steps.gcp-arranque.outcome }}", LANZADO_POR: "${{ github.actor }}",
      LANZADO_POR_PLAN: "${{ inputs.lanzado-por }}" });
    for (const p of PASOS) {
      if (p.id === "token-nucleo" || p.with?.repository === "${{ github.repository_owner }}/Diverger-ExP-Harness") continue;
      expect(JSON.stringify(p), p.name ?? p.id ?? p.uses).not.toMatch(/steps\.token-[a-z-]+\.outputs\.token/);
    }
    // La issue se asigna a quien lanzó el bucle, solo si es una persona: un «…[bot]» no pasa la expresión.
    expect(paso("Bucle").run).toContain('[[ "$LANZADO_POR" =~ ^[A-Za-z0-9][A-Za-z0-9-]{0,38}$ ]] && opciones+=(--notify "$LANZADO_POR")');
  });

  it("ejecuta bucle.py del núcleo contra este repositorio y su rama base", () => {
    const orden = paso("Bucle").run ?? "";
    expect(orden).toContain("python3 .diverger-nucleo/plugins/diverger/server/bucle.py");
    expect(orden).toContain('--repo "$GITHUB_REPOSITORY" --base "$GITHUB_REF_NAME"');
    expect(orden).toContain("--restart");
    expect(paso("Ocultar el núcleo a git").run).toContain(".git/info/exclude");
  });
});

describe("análisis de las tareas bloqueadas (HU-EJE-11, ADR 0078 del harness)", () => {
  const ANALISIS = WF.jobs.analisis ?? { env: {}, steps: [] };
  const pasoAnalisis = (nombre: string): Paso & { if?: string } => {
    const p = ANALISIS.steps.find((x) => x.name === nombre || x.id === nombre);
    if (!p) throw new Error(`Falta el paso «${nombre}» del análisis`);
    return p;
  };

  it("va en un job aparte, después del bucle, y solo si se subió su run.json", () => {
    expect(JOB.outputs).toEqual({ estado: "${{ steps.estado.outcome }}" });
    expect(ANALISIS.needs).toBe("bucle");
    expect(ANALISIS.if).toBe("always() && needs.bucle.outputs.estado == 'success'");
    expect(ANALISIS.permissions).toEqual({ contents: "read", "id-token": "write", issues: "write" });
    const descarga = ANALISIS.steps.find((p) => p.uses?.startsWith("actions/download-artifact@"));
    expect(descarga?.with).toMatchObject({ name: "diverger-bucle-${{ inputs.initiative }}" });
  });

  it("solo lanza el agente si el bucle dejó tareas bloqueadas", () => {
    expect(pasoAnalisis("pendientes").run).toContain('bloqueos.py" pendientes');
    for (const nombre of ["Plugin del analista de bloqueos", "claude", "Analizar los bloqueos", "Comentar las correcciones"]) {
      expect(pasoAnalisis(nombre).if).toMatch(/^steps\.pendientes\.outputs\.tareas != ''/);
    }
    // El plugin solo lleva el agente, sin los hooks ni el servidor MCP del núcleo.
    expect(pasoAnalisis("Plugin del analista de bloqueos").run).toContain("agents/analista-bloqueos.md");
  });

  it("la clave de Anthropic solo está en el paso del agente, que no tiene token de GitHub ni de GCP", () => {
    const conClave = ANALISIS.steps.filter((p) => JSON.stringify(p).includes("ANTHROPIC_API_KEY"));
    expect(conClave.map((p) => p.name)).toEqual(["Analizar los bloqueos"]);
    const analizar = pasoAnalisis("Analizar los bloqueos");
    expect(Object.keys(analizar.env ?? {})).not.toContain("GH_TOKEN");
    expect(analizar.run).toBe("bash .github/diverger/bucle-analisis.sh analizar");
    expect(analizar["continue-on-error"]).toBe(true);
    // El GITHUB_TOKEN del job, que solo escribe issues, solo comenta: ese paso no lanza ningún modelo.
    expect(pasoAnalisis("Comentar las correcciones").env).toEqual({ GH_TOKEN: "${{ github.token }}",
      TAREAS: "${{ steps.pendientes.outputs.tareas }}" });
    expect(pasoAnalisis("Comentar las correcciones").run).toBe("bash .github/diverger/bucle-analisis.sh registrar");
    // El agente solo lee: el script lo lanza con Read, Glob y Grep, un tope por tarea y sin los tokens del job.
    const script = readFileSync(join(RAIZ, ".github", "diverger", "bucle-analisis.sh"), "utf8");
    expect(script).toContain("--agent diverger:analista-bloqueos");
    expect(script).toContain('--tools "Read,Glob,Grep"');
    expect(script).toContain('--max-budget-usd "$TOPE_TAREA"');
    expect(script).toContain("unset GH_TOKEN GITHUB_TOKEN");
  });

  it("registra las correcciones con la cuenta de telemetría, sin fallar el job si no puede", () => {
    const auth = ANALISIS.steps.filter((p) => p.uses?.startsWith("google-github-actions/auth@"));
    expect(auth.map((p) => p.with)).toEqual([{ workload_identity_provider: "${{ vars.GCP_WIF_PROVIDER }}",
      service_account: "${{ vars.GCP_TELEMETRY_SA }}" }]);
    const registrar = pasoAnalisis("Registrar las correcciones");
    expect(registrar["continue-on-error"]).toBe(true);
    expect(registrar.run).toContain('gcloud logging write diverger-ejecucion "$linea" --payload-type=json');
    // gcloud solo escribe ese log: nada de despliegues ni de lecturas de GCP.
    expect(SIN_COMENTARIOS.slice(INICIO_ANALISIS).match(/gcloud [a-z-]+ [a-z-]+/g)).toEqual(["gcloud logging write"]);
  });

  it("valida las entradas y nunca las pega en un script", () => {
    expect(ANALISIS.steps[0]?.name).toBe("Validar las entradas");
    for (const p of ANALISIS.steps) expect(p.run ?? "").not.toContain("${{");
  });
});
