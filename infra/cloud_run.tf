# Servicio de Cloud Run de la aplicación (TA-078): una imagen con el servidor y el frontend.
resource "google_cloud_run_v2_service" "aplicacion" {
  name     = local.nombre
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  # Sin comprobación de IAM al llamar al servicio: la aplicación pide su propio inicio de sesión
  # con Google en /api (ADR 0004). No da permisos a allUsers, que la organización puede prohibir.
  invoker_iam_disabled = var.acceso_publico
  deletion_protection  = var.proteccion_borrado

  template {
    service_account                  = var.cuenta_ejecucion
    max_instance_request_concurrency = 80
    timeout                          = "60s"

    scaling {
      min_instance_count = 0
      max_instance_count = var.instancias_maximas
    }

    containers {
      image = var.imagen_inicial

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      env {
        name  = "FIRESTORE_DATABASE"
        value = local.nombre
      }

      env {
        name  = "GOOGLE_CLIENT_ID"
        value = var.google_client_id
      }

      startup_probe {
        http_get {
          path = "/api/salud"
        }
      }
    }
  }

  # Lo único que la infraestructura deja cambiar fuera de ella: la imagen y la revisión, que son
  # del despliegue continuo (gcloud run deploy --image), y los campos con los que gcloud dice qué
  # cliente hizo el cambio. Cualquier otro cambio a mano aparece en tofu plan y se revierte al
  # aplicar (criterio negativo de EN-GP-03). Tampoco las etiquetas que Cloud Deploy pone en cada
  # revisión (decisión 4 del ADR 0015 del harness); otra etiqueta puesta a mano sí es deriva.
  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      template[0].revision,
      client,
      client_version,
      template[0].labels["delivery-pipeline-id"],
      template[0].labels["location"],
      template[0].labels["managed-by"],
      template[0].labels["project-id"],
      template[0].labels["release-id"],
      template[0].labels["target-id"],
    ]
  }

  depends_on = [google_project_service.apis, google_project_iam_member.datos]
}
