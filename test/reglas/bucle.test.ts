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

interface Paso {
  name?: string;
  id?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, string | boolean>;
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
    expect(entradas["max-workers"]?.default).toBe("1");
    expect(WF["run-name"]).toBe("diverger-bucle ${{ inputs.initiative }}");
  });

  it("un solo bucle por iniciativa, sin cancelar el que está en marcha", () => {
    expect(WF.concurrency).toEqual({ group: "diverger-bucle-${{ inputs.initiative }}", "cancel-in-progress": false });
  });

  it("el token del job es de solo lectura y GCP solo con la cuenta de telemetría", () => {
    expect(WF.permissions).toEqual({ contents: "read" });
    expect(JOB.permissions).toEqual({ contents: "read", "id-token": "write" });
    expect(SIN_COMENTARIOS).not.toMatch(/GCP_DEPLOY_SA|environment:/);
    const auth = PASOS.filter((p) => p.uses?.startsWith("google-github-actions/auth@"));
    expect(auth).toHaveLength(1);
    expect(auth[0]?.with).toEqual({ workload_identity_provider: "${{ vars.GCP_WIF_PROVIDER }}",
      service_account: "${{ vars.GCP_TELEMETRY_SA }}" });
  });

  it("registra el resultado después del bucle, sin fallar el job si no puede", () => {
    const nombres = PASOS.map((p) => p.name ?? p.uses ?? "");
    const bucle = nombres.indexOf("Bucle");
    const auth = nombres.findIndex((n) => n.startsWith("google-github-actions/auth@"));
    const registro = nombres.indexOf("Registrar el resultado");
    expect(bucle).toBeLessThan(auth);
    expect(auth).toBeLessThan(registro);
    expect(paso("Bucle").run).toContain('--results "$RUNNER_TEMP/resultados.jsonl"');
    const registrar = PASOS[registro] as Paso & { if?: string; "continue-on-error"?: boolean };
    expect(registrar.if).toBe("always() && env.TELEMETRIA == 'true'");
    expect(registrar["continue-on-error"]).toBe(true);
    expect(registrar.run).toContain("gcloud logging write diverger-ejecucion \"$linea\" --payload-type=json");
    // gcloud solo escribe ese log: nada de despliegues ni de lecturas de GCP.
    expect(SIN_COMENTARIOS.match(/gcloud [a-z-]+ [a-z-]+/g)).toEqual(["gcloud logging write"]);
  });

  it("no ejecuta ningún modelo", () => {
    expect(SIN_COMENTARIOS).not.toMatch(/claude|ANTHROPIC_API_KEY|anthropic/i);
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

  it("lanza los workers con un token limitado a Actions y lectura de contenido y PR", () => {
    const token = paso("token-bucle");
    const permisos = Object.fromEntries(Object.entries(token.with ?? {}).filter(([k]) => k.startsWith("permission-")));
    expect(permisos).toEqual({ "permission-actions": "write", "permission-contents": "read", "permission-pull-requests": "read" });
    expect(token.with?.repositories).toBe("${{ github.event.repository.name }}");
    expect(paso("Bucle").env).toEqual({ GH_TOKEN: "${{ steps.token-bucle.outputs.token }}" });
  });

  it("ejecuta bucle.py del núcleo contra este repositorio y su rama base", () => {
    const orden = paso("Bucle").run ?? "";
    expect(orden).toContain("python3 .diverger-nucleo/plugins/diverger/server/bucle.py");
    expect(orden).toContain('--repo "$GITHUB_REPOSITORY" --base "$GITHUB_REF_NAME"');
    expect(orden).toContain("--restart");
    expect(paso("Ocultar el núcleo a git").run).toContain(".git/info/exclude");
  });
});
