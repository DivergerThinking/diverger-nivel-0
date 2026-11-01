# Despliegue continuo en staging con Cloud Deploy (EN-FM-04, ADR 0015 del harness): una cadena
# de despliegue con un único destino, el Cloud Run de staging de la aplicación. El job
# «despliegue» del CI crea una versión (release) en esta cadena al integrar en main, y Cloud
# Deploy la despliega con su propia cuenta, sin aprobación: staging no la pide.
#
# La cuenta de Cloud Deploy y su almacén son del proyecto (infra/entornos/gcp.sh del harness);
# aquí solo se nombran. El canary y la promoción a producción llegan en la Fase II, como un
# segundo destino de la misma cadena.
resource "google_clouddeploy_target" "staging" {
  name             = "${local.nombre}-staging"
  location         = var.region
  description      = "Cloud Run de staging de ${var.aplicacion}"
  require_approval = false

  run {
    location = "projects/${var.proyecto}/locations/${var.region}"
  }

  # Cloud Deploy prepara y despliega con esta cuenta, nunca con la cuenta por defecto de Compute
  # Engine, y guarda lo que genera en el almacén de la aplicación.
  execution_configs {
    usages           = ["RENDER", "DEPLOY"]
    service_account  = var.cuenta_cloud_deploy
    artifact_storage = "${var.almacen_cloud_deploy}/${local.nombre}/artefactos"
  }

  depends_on = [google_project_service.apis]
}

resource "google_clouddeploy_delivery_pipeline" "aplicacion" {
  name        = local.nombre
  location    = var.region
  description = "Despliegue continuo de ${var.aplicacion}: staging al integrar en main"

  serial_pipeline {
    stages {
      target_id = google_clouddeploy_target.staging.name
    }
  }

  depends_on = [google_project_service.apis]
}
