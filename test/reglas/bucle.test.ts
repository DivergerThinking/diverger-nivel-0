// Bucle desatendido (HU-EJE-01, ADR 0016 del harness): lo que se puede comprobar del workflow sin
// GitHub. Que se lanza a mano, descarga el núcleo con un token de solo lectura, lanza los workers con
// un token limitado a Actions y lectura, no ejecuta ningún modelo y, de GCP, solo usa la cuenta de
// telemetría al terminar para registrar el resultado (EN-TEL-02, ADR 0017 del harness).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const RAIZ = join(import.meta.dirname, "..", "..");
const TEXTO = readFileSync(join(RAIZ, ".github", "workflows", "diverger-bucle.yml"), "utf8");
const SIN_COMENTARIOS = TEXTO.split("\n").filter((linea) => !linea.trimStart().startsWith("#")).join("\n");
// La comprobación previa (EN-GP-04) es el único paso que recibe el secreto de Anthropic y la variable de la cuenta de
// despliegue, solo para ver que no están vacíos: el resto del workflow no los nombra.
const PREVIA = "Comprobación previa del secreto y las variables";
const INICIO_PREVIA = SIN_COMENTARIOS.indexOf(`      - name: ${PREVIA}\n`);
const SIN_PREVIA = SIN_COMENTARIOS.slice(0, INICIO_PREVIA)
  + SIN_COMENTARIOS.slice(SIN_COMENTARIOS.indexOf("\n      - ", INICIO_PREVIA + 1));

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
  jobs: Record<string, { permissions?: Record<string, string>; env: Record<string, string>; steps: Paso[] }>;
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
    expect(Object.keys(entradas)).toEqual(["initiative", "max-workers", "restart"]);
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

  it("un solo bucle por iniciativa, sin cancelar el que está en marcha", () => {
    expect(WF.concurrency).toEqual({ group: "diverger-bucle-${{ inputs.initiative }}", "cancel-in-progress": false });
  });

  it("el token del job es de solo lectura y GCP solo con la cuenta de telemetría", () => {
    expect(WF.permissions).toEqual({ contents: "read" });
    expect(JOB.permissions).toEqual({ contents: "read", "id-token": "write" });
    expect(INICIO_PREVIA).toBeGreaterThan(0);
    expect(SIN_PREVIA).not.toMatch(/GCP_DEPLOY_SA|environment:/);
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
    expect(SIN_COMENTARIOS.match(/gcloud [a-z-]+ [a-z-]+/g)).toEqual(["gcloud logging write"]);
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

  it("lanza los workers con un token limitado a Actions, issues y lectura de contenido y PR", () => {
    const token = paso("token-bucle");
    const permisos = Object.fromEntries(Object.entries(token.with ?? {}).filter(([k]) => k.startsWith("permission-")));
    // issues: write, para avisar de una tarea bloqueada (harness ADR 0029).
    expect(permisos).toEqual({ "permission-actions": "write", "permission-contents": "read", "permission-issues": "write",
      "permission-pull-requests": "read" });
    expect(token.with?.repositories).toBe("${{ github.event.repository.name }}");
    expect(paso("Bucle").env).toEqual({ GH_TOKEN: "${{ steps.token-bucle.outputs.token }}",
      GCP_ARRANQUE: "${{ steps.gcp-arranque.outcome }}", LANZADO_POR: "${{ github.actor }}" });
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
