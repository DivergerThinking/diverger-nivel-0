// Despliegue continuo en staging (EN-FM-04, ADR 0015 del harness): lo que se puede comprobar leyendo
// los workflows y infra/ sin GCP. Que de verdad despliegue, y que un worker no pueda, se prueba en el
// proyecto de pruebas (README, «Despliegue en staging»).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(import.meta.dirname, "..", "..");
const WORKFLOWS = join(RAIZ, ".github", "workflows");

function leer(ruta: string): string {
  return readFileSync(join(RAIZ, ruta), "utf8");
}

/** Los jobs de un workflow por su nombre, con su texto sin comentarios (dos espacios de sangría bajo «jobs:»). */
function jobs(workflow: string): Record<string, string> {
  const bloque = (workflow.split(/^jobs:\s*$/m)[1] ?? "").replace(/^\s*#.*\n/gm, "");
  const partes = bloque.split(/^ {2}([\w-]+):\s*$/m);
  const resultado: Record<string, string> = {};
  for (let i = 1; i < partes.length - 1; i += 2) resultado[partes[i] ?? ""] = partes[i + 1] ?? "";
  return resultado;
}

/** Lo que va antes de «jobs:»: el disparador y los permisos de todo el workflow. */
function cabecera(workflow: string): string {
  return workflow.split(/^jobs:\s*$/m)[0] ?? "";
}

const workflows = readdirSync(WORKFLOWS)
  .filter((nombre) => /\.ya?ml$/.test(nombre))
  .map((nombre) => ({ nombre, texto: readFileSync(join(WORKFLOWS, nombre), "utf8") }));

const ci = leer(".github/workflows/ci.yml");
const despliegue = jobs(ci).despliegue ?? "";

describe("despliegue en staging", () => {
  it("el CI tiene el job despliegue, detrás de la calidad, la imagen y la infraestructura", () => {
    expect(despliegue).not.toBe("");
    expect(despliegue).toMatch(/^ {4}needs: \[calidad, imagen, infraestructura\]$/m);
  });

  it("solo despliega al integrar en main y si el repositorio tiene el despliegue configurado", () => {
    const condicion = /^ {4}if: (.+)$/m.exec(despliegue)?.[1] ?? "";
    expect(condicion).toContain("github.ref == 'refs/heads/main'");
    expect(condicion).toContain("github.event_name != 'pull_request'");
    expect(condicion).toContain("vars.GCP_WIF_PROVIDER != ''");
    expect(cabecera(ci)).toMatch(/^ {2}push:\n {4}branches: \[main\]$/m);
  });

  it("corre en el environment staging, el único que acepta la cuenta de despliegue", () => {
    expect(despliegue).toMatch(/^ {4}environment:\n {6}name: staging$/m);
    expect(despliegue).toMatch(/^ {6}cancel-in-progress: false$/m);
  });

  it("entra en GCP con Workload Identity Federation y la cuenta de despliegue, sin claves", () => {
    expect(despliegue).toMatch(/^ {6}id-token: write$/m);
    expect(despliegue).toContain("uses: google-github-actions/auth@");
    expect(despliegue).toContain("workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}");
    expect(despliegue).toContain("service_account: ${{ vars.GCP_DEPLOY_SA }}");
    for (const { nombre, texto } of workflows) {
      expect(texto, nombre).not.toMatch(/credentials_json|GOOGLE_CREDENTIALS|service_account_key|secrets\.GCP/);
      expect(texto, nombre).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----|"private_key"/);
    }
  });

  it("despliega la imagen analizada: la sube a Artifact Registry y la despliega por su digest", () => {
    expect(jobs(ci).imagen).toContain("docker save aplicacion:ci");
    expect(despliegue).toContain("docker load");
    expect(despliegue).not.toContain("docker build");
    expect(despliegue).toContain('docker push "$IMAGEN"');
    expect(despliegue).toContain("{{index .RepoDigests 0}}");
    expect(despliegue).toContain("-docker.pkg.dev/$proyecto/$aplicacion/$aplicacion:$GITHUB_SHA");
  });

  it("despliega con Cloud Deploy y no directamente en Cloud Run", () => {
    expect(despliegue).toContain("gcloud deploy releases create");
    expect(despliegue).toContain('--delivery-pipeline "$APLICACION"');
    expect(despliegue).toContain("gcloud deploy rollouts list");
    for (const prohibido of [/gcloud run deploy/, /gcloud run services (update|replace)/, /gcloud run services update-traffic/, /\btofu (apply|destroy)\b/, /\bterraform (apply|destroy)\b/]) {
      expect(despliegue).not.toMatch(prohibido);
    }
  });

  // ADR 0013: la imagen y la revisión son del despliegue continuo; el resto del servicio, de infra/.
  it("solo cambia la imagen: el manifiesto es el del servicio desplegado con la imagen nueva", () => {
    expect(despliegue).toContain("gcloud run services describe \"$APLICACION\" --project \"$PROYECTO\" --region \"$REGION\" --format export");
    const yq = /yq -i '([^']+)'/.exec(despliegue)?.[1] ?? "";
    const cambios = yq.split("|").map((cambio) => cambio.trim());
    expect(cambios).toEqual([
      "del(.metadata.namespace)",
      "del(.spec.template.metadata.name)",
      // Cloud Deploy fija el tráfico en su revisión: tras un fallo quedaría en la revisión rota.
      "del(.spec.traffic)",
      ".spec.template.spec.containers[0].image = strenv(IMAGEN)",
    ]);
    expect(despliegue).toContain('--from-run-manifest "$RUNNER_TEMP/despliegue/service.yaml"');
  });

  it("comprueba que staging sirve la imagen nueva y responde", () => {
    expect(despliegue).toContain('test "$desplegada" = "$IMAGEN"');
    expect(despliegue).toContain('"$url/api/salud"');
  });

  it("lee el proyecto, la región, la aplicación y el almacén de infra/staging.tfvars", () => {
    expect(despliegue).toContain("infra/staging.tfvars");
    const staging = leer("infra/staging.tfvars");
    for (const dato of ["proyecto", "region", "aplicacion", "almacen_cloud_deploy"]) {
      expect(staging).toMatch(new RegExp(`^${dato}\\s*=\\s*"[^"]+"$`, "m"));
    }
  });

  // EN-FM-03, ADR 0020 del harness: sin GOOGLE_CLIENT_ID la API protegida responde 503 a todos, y el
  // validador en staging pide su token de identidad con esa audiencia.
  it("staging tiene el ID del cliente OAuth de Google", () => {
    const staging = leer("infra/staging.tfvars");
    expect(staging).toMatch(/^google_client_id\s*=\s*"\d+-[a-z0-9]+\.apps\.googleusercontent\.com"$/m);
  });
});

// RQ.034: ningún agente tiene credenciales de despliegue. Un worker corre en su propio job y puede
// pedir un token de GitHub (lo necesita el Collector de la telemetría, ADR 0007), pero la cuenta de
// despliegue solo lo acepta de un job del environment staging.
describe("los workers no pueden desplegar", () => {
  const todos = workflows.flatMap(({ nombre, texto }) =>
    Object.entries(jobs(texto)).map(([job, cuerpo]) => ({ nombre, job, cuerpo })),
  );

  it("ningún workflow da id-token a todos sus jobs", () => {
    for (const { nombre, texto } of workflows) expect(cabecera(texto).replace(/^\s*#.*$/gm, ""), nombre).not.toContain("id-token");
  });

  it("solo los jobs del environment staging usan la cuenta de despliegue", () => {
    const conCuenta = todos.filter(({ cuerpo }) => cuerpo.includes("GCP_DEPLOY_SA"));
    expect(conCuenta.map(({ job }) => job)).toEqual(["despliegue"]);
    for (const { nombre, job, cuerpo } of conCuenta) {
      expect(cuerpo, `${nombre}/${job}`).toMatch(/^ {4}environment:\n {6}name: staging$/m);
    }
  });

  it("ningún job que lanza Claude Code está en el environment staging ni usa la cuenta de despliegue", () => {
    const conAgente = todos.filter(({ cuerpo }) => /anthropics\/claude-code-action|\bclaude -p\b|@anthropic-ai\/claude-code/.test(cuerpo));
    for (const { nombre, job, cuerpo } of conAgente) {
      expect(cuerpo, `${nombre}/${job}`).not.toMatch(/environment:|GCP_DEPLOY_SA/);
    }
  });

  // ADR 0007, revisado el 30/10/2026: un worker puede tener id-token para la telemetría, pero en GCP
  // solo puede pedir la cuenta de telemetría, que solo escribe logs y métricas.
  it("un job que lanza Claude Code con id-token solo pide la cuenta de telemetría", () => {
    const conAgente = todos.filter(({ cuerpo }) => /anthropics\/claude-code-action|\bclaude -p\b|@anthropic-ai\/claude-code/.test(cuerpo));
    expect(conAgente.map(({ nombre, job }) => `${nombre}/${job}`)).toContain("diverger-worker.yml/worker");
    for (const { nombre, job, cuerpo } of conAgente.filter(({ cuerpo }) => /^ {6}id-token: write\b/m.test(cuerpo))) {
      const cuentas = [...cuerpo.matchAll(/service_account: (.+)$/gm)].map((m) => m[1]?.trim());
      expect(cuentas, `${nombre}/${job}`).toEqual(["${{ vars.GCP_TELEMETRY_SA }}"]);
      expect(cuerpo, `${nombre}/${job}`).not.toMatch(/^ {4}environment:/m);
    }
  });

  it("el job despliegue no lanza Claude Code", () => {
    expect(despliegue).not.toMatch(/claude/i);
  });
});
