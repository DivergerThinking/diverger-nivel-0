// Infraestructura como código (EN-GP-03): lo que se puede comprobar leyendo infra/ sin OpenTofu
// ni GCP. El plan con el proveedor simulado lo prueban tofu test y terraform test en el job
// infraestructura del CI.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(import.meta.dirname, "..", "..");
const INFRA = join(RAIZ, "infra");

function leer(ruta: string): string {
  return readFileSync(join(RAIZ, ruta), "utf8");
}

function ficheros(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    if (nombre === ".terraform") return [];
    return statSync(ruta).isDirectory() ? ficheros(ruta) : [ruta];
  });
}

const tf = ficheros(INFRA)
  .filter((ruta) => ruta.endsWith(".tf"))
  .map((ruta) => readFileSync(ruta, "utf8"))
  .join("\n");

describe("infraestructura como código", () => {
  it("describe el servicio de Cloud Run, la base de Firestore y el repositorio de Artifact Registry", () => {
    expect(tf).toMatch(/resource "google_cloud_run_v2_service" "aplicacion"/);
    expect(tf).toMatch(/resource "google_firestore_database" "datos"/);
    expect(tf).toMatch(/resource "google_artifact_registry_repository" "imagenes"/);
  });

  it("usa europe-west1 por defecto y el proyecto de pruebas en staging", () => {
    expect(leer("infra/variables.tf")).toMatch(/variable "region" \{[^}]*default\s*=\s*"europe-west1"/s);
    const staging = leer("infra/staging.tfvars");
    expect(staging).toMatch(/^proyecto\s*=\s*"diverger-exp-harness"$/m);
    expect(staging).toMatch(/^region\s*=\s*"europe-west1"$/m);
    expect(staging).toMatch(/^cuenta_ejecucion\s*=\s*"diverger-run@diverger-exp-harness\.iam\.gserviceaccount\.com"$/m);
  });

  it("guarda el estado en un bucket y no en el repositorio", () => {
    expect(tf).toMatch(/backend "gcs" \{\}/);
    expect(leer("infra/staging.gcs.tfbackend")).toMatch(/^prefix\s*=\s*"[a-z0-9-]+\/staging"$/m);
    const ignorados = leer(".gitignore");
    for (const ruta of ["infra/.terraform/", "infra/*.tfstate", "infra/*.tfstate.*", "infra/*.tfplan"]) {
      expect(ignorados.split("\n")).toContain(ruta);
    }
  });

  it("no lleva credenciales: ni claves, ni ficheros de cuenta de servicio, ni tokens en el proveedor", () => {
    const problemas = ficheros(INFRA).flatMap((ruta) => {
      const texto = readFileSync(ruta, "utf8");
      const nombre = relative(RAIZ, ruta);
      const hallazgos: string[] = [];
      if (/"private_key"|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(texto)) hallazgos.push(`${nombre}: clave privada`);
      if (/^\s*(credentials|access_token)\s*=/m.test(texto)) hallazgos.push(`${nombre}: credenciales en el proveedor`);
      if (/\.tfstate/.test(nombre)) hallazgos.push(`${nombre}: estado en el repositorio`);
      return hallazgos;
    });
    expect(problemas).toEqual([]);
  });

  // Criterio negativo de EN-GP-03: un cambio a mano en el servicio aparece en el plan y se
  // revierte. Solo la imagen, que es del despliegue continuo, y los campos con los que gcloud firma
  // el cambio quedan fuera, y las etiquetas con las que Cloud Deploy marca cada revisión, una a una.
  // Ignorar algo más dejaría pasar la deriva. El nombre de la revisión no: ignorarlo hacía que
  // cualquier cambio del template fallara con 409 (#25).
  it("solo deja fuera de la deriva la imagen, el cliente y las etiquetas de Cloud Deploy", () => {
    const bloque = /ignore_changes\s*=\s*\[([\s\S]*?)\n\s*\]/.exec(leer("infra/cloud_run.tf"));
    const ignorados = (bloque?.[1] ?? "")
      .split(",")
      .map((campo) => campo.trim())
      .filter(Boolean);
    const etiquetas = ["delivery-pipeline-id", "location", "managed-by", "project-id", "release-id", "target-id"];
    const esperados = ["client", "client_version", "template[0].containers[0].image"];
    expect(ignorados).not.toContain("template[0].revision");
    esperados.push(...etiquetas.map((etiqueta) => `template[0].labels["${etiqueta}"]`));
    expect(ignorados.sort()).toEqual(esperados.sort());
    expect(tf.match(/ignore_changes/g)).toHaveLength(1);
  });

  it("firestore.indexes.json tiene el formato de Firebase", () => {
    for (const fichero of ["infra/firestore.indexes.json", "infra/tests/indices-de-prueba.json"]) {
      const { indexes } = JSON.parse(leer(fichero)) as { indexes: { collectionGroup: string; fields: { fieldPath: string; order?: string; arrayConfig?: string }[] }[] };
      expect(Array.isArray(indexes)).toBe(true);
      for (const indice of indexes) {
        expect(indice.collectionGroup).toMatch(/^\w+$/);
        expect(indice.fields.length).toBeGreaterThan(1);
        for (const campo of indice.fields) {
          expect(campo.fieldPath).toBeTruthy();
          expect(Boolean(campo.order) !== Boolean(campo.arrayConfig)).toBe(true);
        }
      }
    }
  });

  it("el CI valida la infraestructura y pasa sus pruebas", () => {
    const ci = leer(".github/workflows/ci.yml");
    for (const paso of ["tofu fmt -check -recursive", "tofu init -backend=false", "tofu validate", "tofu test"]) {
      expect(ci).toContain(paso);
    }
  });

  // Regla de portabilidad del ADR 0013 del harness: infra/ solo usa lo que entienden OpenTofu y
  // Terraform, así que el mismo job lo inicia, valida y prueba también con Terraform.
  it("el CI pasa también Terraform, con su suma comprobada y sin el fichero de bloqueo de OpenTofu", () => {
    const ci = leer(".github/workflows/ci.yml");
    expect(ci).toMatch(/^\s+TERRAFORM_VERSION: \d+\.\d+\.\d+$/m);
    expect(ci).toMatch(/^\s+TERRAFORM_SHA256: [0-9a-f]{64}$/m);
    expect(ci).toContain("https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/");
    expect(ci).toContain('echo "${TERRAFORM_SHA256}  $f" | sha256sum -c -');
    expect(ci).toContain('rm -rf "$copia/.terraform" "$copia/.terraform.lock.hcl"');
    expect(ci).toContain(`sed -i 's/backend "gcs"/backend "local"/'`);
    for (const paso of ["terraform init -backend=false", "terraform init -input=false", "terraform validate", "terraform test"]) {
      expect(ci).toContain(paso);
    }
    // Terraform trabaja en la copia: nunca en infra/, donde reescribiría el bloqueo de OpenTofu.
    const pasos = ci.split(/\n(?=\s+- (?:name|uses):)/).filter((paso) => /\bterraform (init|validate|test)\b/.test(paso));
    expect(pasos).toHaveLength(4);
    for (const paso of pasos) expect(paso).toContain("working-directory: ${{ runner.temp }}/infra-terraform");
  });

  it("el bloque backend está vacío: el bucket y el prefijo van en staging.gcs.tfbackend", () => {
    expect(tf.match(/backend "[a-z]+"\s*\{[^}]*\}/g)).toEqual(['backend "gcs" {}']);
  });
});

const SCRIPT_IAM = join(RAIZ, "scripts", "iam.mjs");
const SERVICE_ACCOUNT_USER = "serviceAccountUser debe concederse solo sobre la cuenta de ejecución, no a nivel de proyecto";
const ROL_BASICO = "los roles básicos (Editor, Owner, Viewer) no se conceden en la infraestructura del proyecto";
const POLITICA = "las políticas completas de IAM (google_*_iam_policy) no se usan: sustituyen la política entera";
const NO_LITERAL = 'el rol tiene que ser una cadena literal, como "roles/datastore.user", para poder comprobarlo';
const TF_JSON = "la infraestructura va en ficheros .tf o .tofu, no .tf.json ni .tofu.json, para que se pueda revisar";

/** node scripts/iam.mjs sobre una carpeta con este fichero: el código y los errores, uno por línea. */
function iam(tf: string, nombre = "main.tf"): { codigo: number | null; errores: string[] } {
  const carpeta = mkdtempSync(join(tmpdir(), "iam-"));
  try {
    writeFileSync(join(carpeta, nombre), tf);
    const r = spawnSync(process.execPath, [SCRIPT_IAM, carpeta], { encoding: "utf8" });
    const errores = r.stderr.split("\n").filter(Boolean).map((l) => l.replace(/^::error file=[^:]*::.*?\.(tf|tofu)(\.json)?: /, ""));
    return { codigo: r.status, errores };
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
}

describe("mínimo privilegio en GCP (EN-GP-05 del harness)", () => {
  it("la infraestructura de la plantilla no concede serviceAccountUser a nivel de proyecto ni roles básicos", () => {
    const r = spawnSync(process.execPath, [SCRIPT_IAM, INFRA], { encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
  });

  it("serviceAccountUser a nivel de proyecto falla con el mensaje del criterio", () => {
    const malo = `resource "google_project_iam_member" "desplegar" {
  project = var.proyecto
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:\${var.cuenta_despliegue}"
}`;
    expect(iam(malo)).toEqual({ codigo: 1, errores: [`google_project_iam_member.desplegar: ${SERVICE_ACCOUNT_USER}`] });
    for (const tipo of ["google_project_iam_binding", "google_folder_iam_member", "google_organization_iam_binding"]) {
      expect(iam(malo.replace("google_project_iam_member", tipo)).errores).toHaveLength(1);
    }
  });

  it("serviceAccountUser sobre la cuenta de ejecución sí vale", () => {
    const bueno = `resource "google_service_account_iam_member" "desplegar_como_ejecucion" {
  service_account_id = "projects/\${var.proyecto}/serviceAccounts/\${var.cuenta_ejecucion}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:\${var.cuenta_despliegue}"
}`;
    expect(iam(bueno)).toEqual({ codigo: 0, errores: [] });
  });

  it("los roles básicos a nivel de proyecto fallan, y uno en un comentario no cuenta", () => {
    const editor = `resource "google_project_iam_member" "todo" {
  # role = "roles/iam.serviceAccountUser" es lo que no hay que hacer
  /* role = "roles/owner" tampoco */
  project     = var.proyecto
  role        = "roles/editor"
  member      = "serviceAccount:x@y.iam.gserviceaccount.com"
  description = "con } dentro"
}
resource "google_project_iam_member" "siguiente" {
  role = "roles/owner"
}`;
    expect(iam(editor)).toEqual({ codigo: 1, errores: [`google_project_iam_member.todo: ${ROL_BASICO}`,
      `google_project_iam_member.siguiente: ${ROL_BASICO}`] });
  });

  it("no se lo salta un rol fuera del recurso: locals, for_each, una política con data o un heredoc (revisión de la PR #62)", () => {
    const locals = `locals {
  rol = "roles/iam.serviceAccountUser"
}
resource "google_project_iam_member" "x" {
  role = local.rol
}`;
    expect(iam(locals)).toEqual({ codigo: 1, errores: [`google_project_iam_member.x: ${NO_LITERAL}`,
      `fuera de un recurso: ${SERVICE_ACCOUNT_USER}`] });
    const bucle = `resource "google_project_iam_member" "x" {
  for_each = toset(["roles/iam.serviceAccountUser", "roles/editor"])
  role     = each.value
}`;
    expect(iam(bucle).errores).toEqual([`google_project_iam_member.x: ${NO_LITERAL}`,
      `google_project_iam_member.x: ${SERVICE_ACCOUNT_USER}`, `google_project_iam_member.x: ${ROL_BASICO}`]);
    const politica = `data "google_iam_policy" "p" {
  binding {
    role    = "roles/iam.serviceAccountUser"
    members = ["serviceAccount:x@y.iam.gserviceaccount.com"]
  }
}
resource "google_project_iam_policy" "p" {
  project     = var.proyecto
  policy_data = data.google_iam_policy.p.policy_data
}`;
    expect(iam(politica).errores).toEqual([`google_project_iam_policy.p: ${POLITICA}`,
      `fuera de un recurso: ${SERVICE_ACCOUNT_USER}`]);
    const heredoc = `resource "terraform_data" "ayuda" {
  input = <<EOT
una llave { y una comilla " sin cerrar
EOT
}
resource google_project_iam_member todo {
  role = "roles/owner"
}`;
    expect(iam(heredoc).errores).toEqual([`google_project_iam_member.todo: ${ROL_BASICO}`]);
  });

  it("un .tf.json o un .tofu.json no vale, y un .tofu se revisa como un .tf", () => {
    expect(iam("{}", "main.tf.json")).toEqual({ codigo: 1, errores: [TF_JSON] });
    expect(iam("{}", "main.tofu.json")).toEqual({ codigo: 1, errores: [TF_JSON] });
    expect(iam(`resource "google_project_iam_member" "x" {
  role = "roles/owner"
}`, "main.tofu").errores).toEqual([`google_project_iam_member.x: ${ROL_BASICO}`]);
  });

  it("un rol construido no vale, y una interpolación con comillas y llaves no descuadra los bloques (revisión de seguridad)", () => {
    const construido = `resource "google_project_iam_member" "x" {
  role = "roles/\${"edit"}or"
}`;
    expect(iam(construido).errores).toEqual([`google_project_iam_member.x: ${NO_LITERAL}`]);
    // La cadena con "}" dentro de la interpolación no cierra el recurso permitido: el de proyecto sigue fuera de él.
    const interpolacion = `resource "google_service_account_iam_member" "ok" {
  service_account_id = "\${replace("a}b", "}", "")}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:x@y.iam.gserviceaccount.com"
}
resource "google_project_iam_member" "malo" {
  role = "roles/iam.serviceAccountUser"
}`;
    expect(iam(interpolacion).errores).toEqual([`google_project_iam_member.malo: ${SERVICE_ACCOUNT_USER}`]);
    // $${ y %%{ son llaves escapadas, no interpolaciones: no se tragan la comilla de cierre.
    const escapada = `resource "google_service_account_iam_member" "ok" {
  service_account_id = "$\${"
  role               = "roles/iam.serviceAccountUser"
}
resource "google_project_iam_member" "malo" {
  role = "roles/iam.serviceAccountUser"
}`;
    expect(iam(escapada).errores).toEqual([`google_project_iam_member.malo: ${SERVICE_ACCOUNT_USER}`]);
  });

  it("si una cadena o un bloque no se cierra, falla en vez de fiarse de lo leído", () => {
    for (const tf of ['resource "google_project_iam_member" "x" {\n  role = "roles/owner', 'resource "a" "b" {\n',
      'locals {\n  x = "${"\n}\n']) {
      expect(iam(tf)).toEqual({ codigo: 1, errores: ["no se puede leer: una cadena, un heredoc o un bloque no se cierra"] });
    }
  });

  it("el CI lo comprueba en el job infraestructura, desde la raíz", () => {
    const ci = leer(".github/workflows/ci.yml");
    const paso = ci.split(/\n(?=\s+- (?:name|uses):)/).find((p) => p.includes("Mínimo privilegio en GCP")) ?? "";
    expect(paso).toContain("working-directory: .");
    expect(paso).toContain("run: node scripts/iam.mjs infra");
    expect(ci.indexOf("Mínimo privilegio en GCP")).toBeGreaterThan(ci.indexOf("  infraestructura:"));
  });
});
