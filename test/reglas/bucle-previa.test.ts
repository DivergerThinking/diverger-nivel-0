// Comprobación previa de una ejecución desatendida (EN-GP-04, RQ.060, ADR 0049 del harness): los pasos de
// diverger-bucle.yml y su script, .github/diverger/bucle-previa.sh. Se saltan donde no hay bash (en el CI sí está).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

const RAIZ = join(import.meta.dirname, "..", "..");
const SCRIPT = join(RAIZ, ".github", "diverger", "bucle-previa.sh");
interface Paso { name?: string; id?: string; uses?: string; run?: string; env?: Record<string, string>;
  with?: Record<string, string | boolean>; "continue-on-error"?: boolean; if?: string }
const WF = parse(readFileSync(join(RAIZ, ".github", "workflows", "diverger-bucle.yml"), "utf8")) as {
  jobs: { bucle: { env: Record<string, string>; steps: Paso[] } };
};
const PASOS = WF.jobs.bucle.steps;
const indice = (nombre: string) => PASOS.findIndex((p) => p.name === nombre || p.id === nombre);
const HAY_BASH = spawnSync("bash", ["-c", "true"]).status === 0;
const REPO = "DivergerThinking/diverger-nivel-0";
const SECRETO = "sk-ant-valor-que-no-se-imprime";
const VARIABLES = {
  GCP_PROJECT_ID: "diverger-exp-harness", GCP_REGION: "europe-west1",
  GCP_WIF_PROVIDER: "projects/1/locations/global/workloadIdentityPools/github/providers/github-actions",
  GCP_DEPLOY_SA: "diverger-deploy@diverger-exp-harness.iam.gserviceaccount.com",
  GCP_ARTIFACT_REPO: "europe-west1-docker.pkg.dev/diverger-exp-harness/diverger",
  GCP_TELEMETRY_SA: "diverger-telemetria@diverger-exp-harness.iam.gserviceaccount.com",
};

describe("forma de la comprobación previa en el bucle", () => {
  it("va antes de pedir el token que lanza los workers y antes del bucle", () => {
    for (const nombre of ["Comprobación previa del secreto y las variables", "previa-gcp", "Comprobación previa del acceso a GCP"]) {
      expect(indice(nombre), nombre).toBeGreaterThan(0);
      expect(indice(nombre)).toBeLessThan(indice("Token para lanzar los workers"));
      expect(PASOS[indice(nombre)]?.if).toBeUndefined();
    }
    expect(indice("Comprobación previa del secreto y las variables")).toBeLessThan(indice("previa-gcp"));
    expect(indice("previa-gcp")).toBeLessThan(indice("Comprobación previa del acceso a GCP"));
    expect(indice("Comprobación previa del acceso a GCP")).toBeLessThan(indice("Bucle"));
  });

  it("el secreto solo entra en el env del primer paso, y las variables, desde vars", () => {
    const primero = PASOS[indice("Comprobación previa del secreto y las variables")];
    expect(primero?.env).toEqual({
      CLAVE_ANTHROPIC: "${{ secrets.ANTHROPIC_API_KEY }}",
      GCP_REGION: "${{ vars.GCP_REGION }}", GCP_WIF_PROVIDER: "${{ vars.GCP_WIF_PROVIDER }}",
      GCP_DEPLOY_SA: "${{ vars.GCP_DEPLOY_SA }}", GCP_ARTIFACT_REPO: "${{ vars.GCP_ARTIFACT_REPO }}",
      GCP_TELEMETRY_SA: "${{ vars.GCP_TELEMETRY_SA }}",
    });
    expect(WF.jobs.bucle.env.GCP_PROJECT_ID).toBe("${{ vars.GCP_PROJECT_ID }}");
    const otros = PASOS.filter((p) => p !== primero);
    expect(JSON.stringify(otros)).not.toContain("secrets.ANTHROPIC_API_KEY");
    expect(JSON.stringify(WF.jobs.bucle.env)).not.toContain("secrets.");
  });

  it("pide de verdad un token de la cuenta de telemetría y deja seguir para dar el motivo", () => {
    const gcp = PASOS[indice("previa-gcp")];
    expect(gcp?.uses).toMatch(/^google-github-actions\/auth@[0-9a-f]{40}$/);
    expect(gcp?.["continue-on-error"]).toBe(true);
    expect(gcp?.with).toEqual({ workload_identity_provider: "${{ vars.GCP_WIF_PROVIDER }}",
      service_account: "${{ vars.GCP_TELEMETRY_SA }}", token_format: "access_token", access_token_lifetime: "300s",
      create_credentials_file: false, export_environment_variables: false });
    const despues = PASOS[indice("Comprobación previa del acceso a GCP")];
    expect(despues?.env).toEqual({ RESULTADO: "${{ steps.previa-gcp.outcome }}" });
    expect(despues?.run).toBe('bash .github/diverger/bucle-previa.sh gcp "$RESULTADO"');
  });
});

describe("si la comprobación previa para el job", () => {
  it("no se sube run.json ni se pide otro token ni se registra nada: el bucle no ha corrido", () => {
    // «Recuperar el estado anterior» va después de la comprobación: si esta falla, no corre.
    expect(indice("Comprobación previa del acceso a GCP")).toBeLessThan(indice("estado"));
    const finales = PASOS.slice(indice("Bucle") + 1);
    expect(finales.length).toBe(3);
    for (const paso of finales) expect(paso.if, paso.name ?? paso.uses).toMatch(/^always\(\) && .*steps\.estado\.outcome == 'success'$/);
  });
});

describe.skipIf(!HAY_BASH)("script de la comprobación previa", () => {
  let dir = "";
  let resumen = "";

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "previa-"));
    resumen = join(dir, "resumen.md");
    writeFileSync(resumen, "");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function ejecutar(args: string[], cambios: Record<string, string | undefined> = {}) {
    // Un valor undefined es una variable que no existe en el job.
    const env = Object.fromEntries(Object.entries({ PATH: process.env.PATH, GITHUB_REPOSITORY: REPO,
      GITHUB_STEP_SUMMARY: resumen, CLAVE_ANTHROPIC: SECRETO, ...VARIABLES, ...cambios })
      .filter((entrada): entrada is [string, string] => entrada[1] !== undefined));
    const r = spawnSync("bash", [SCRIPT, ...args], { env, encoding: "utf8" });
    return { codigo: r.status, salida: r.stdout + r.stderr, resumen: readFileSync(resumen, "utf8") };
  }

  it("con el secreto y las seis variables pasa y lo anota en el resumen", () => {
    const r = ejecutar(["secreto-y-variables"]);
    expect(r.codigo).toBe(0);
    expect(r.resumen).toContain("## Comprobación previa");
    expect(r.resumen).toContain("- [OK] El secreto ANTHROPIC_API_KEY no está vacío");
    expect(r.resumen).toContain("- [OK] Están las variables GCP_PROJECT_ID GCP_REGION GCP_WIF_PROVIDER GCP_DEPLOY_SA GCP_ARTIFACT_REPO GCP_TELEMETRY_SA");
    const gcp = ejecutar(["gcp", "success"]);
    expect(gcp.codigo).toBe(0);
    expect(gcp.resumen).toContain(`- [OK] La federación de identidades de GCP deja entrar a ${REPO} con la cuenta de telemetría`);
    expect(gcp.resumen).toContain("La ejecución puede empezar.");
  });

  it("con el secreto vacío se para con el mensaje y la orden que lo arregla", () => {
    const r = ejecutar(["secreto-y-variables"], { CLAVE_ANTHROPIC: "" });
    expect(r.codigo).toBe(1);
    expect(r.salida).toContain("::error::El secreto ANTHROPIC_API_KEY está vacío");
    expect(r.resumen).toContain(`\`gh secret set ANTHROPIC_API_KEY --repo ${REPO}\``);
    expect(r.resumen).toContain("La ejecución se para sin lanzar ningún worker.");
  });

  it("sin GCP_REGION se para con el mensaje y la orden que lo arregla", () => {
    const r = ejecutar(["secreto-y-variables"], { GCP_REGION: undefined });
    expect(r.codigo).toBe(1);
    expect(r.salida).toContain("::error::Falta la variable GCP_REGION");
    expect(r.resumen).toContain(`\`gh variable set GCP_REGION --repo ${REPO}\``);
    expect(r.resumen).not.toContain("[OK] Están las variables");
  });

  it("dice todo lo que falta de una vez, no solo lo primero", () => {
    const r = ejecutar(["secreto-y-variables"], { CLAVE_ANTHROPIC: "", GCP_DEPLOY_SA: "", GCP_TELEMETRY_SA: undefined });
    expect(r.codigo).toBe(1);
    for (const texto of ["El secreto ANTHROPIC_API_KEY está vacío", "Falta la variable GCP_DEPLOY_SA", "Falta la variable GCP_TELEMETRY_SA"]) {
      expect(r.salida).toContain(`::error::${texto}`);
    }
  });

  it("si la federación rechaza el token, dice que no responde para el repositorio y da la orden de gcp.sh", () => {
    const r = ejecutar(["gcp", "failure"]);
    expect(r.codigo).toBe(1);
    expect(r.salida).toContain(`::error::La federación de identidades de GCP no responde para ${REPO}`);
    expect(r.resumen).toContain("`PROJECT_ID=diverger-exp-harness REPOS=diverger-nivel-0 ./infra/entornos/gcp.sh`");
    // gcp.sh no arregla un valor erróneo de las variables ni un lanzamiento desde otra rama (revisión de la PR #56).
    expect(r.resumen).toContain("- que GCP_WIF_PROVIDER y GCP_TELEMETRY_SA son los valores que imprime gcp.sh al terminar;");
    expect(r.resumen).toContain("- que el bucle se lanza desde main: GCP solo acepta la cuenta desde los workflows de esa rama;");
    expect(r.resumen).toContain("- el error del paso anterior, por si Google falló en ese momento.");
    expect(r.resumen).toContain("La ejecución se para sin lanzar ningún worker.");
  });

  it("nunca imprime el valor del secreto", () => {
    for (const args of [["secreto-y-variables"], ["gcp", "success"], ["gcp", "failure"]]) {
      const r = ejecutar(args);
      expect(r.salida + r.resumen).not.toContain(SECRETO);
    }
  });

  it("sin argumento válido no hace nada y sale con 2", () => {
    expect(ejecutar([]).codigo).toBe(2);
    expect(ejecutar(["otra"]).codigo).toBe(2);
  });
});
