// Infraestructura como código (EN-GP-03): lo que se puede comprobar leyendo infra/ sin OpenTofu
// ni GCP. El plan con el proveedor simulado lo prueban tofu test y terraform test en el job
// infraestructura del CI.
import { readdirSync, readFileSync, statSync } from "node:fs";
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
