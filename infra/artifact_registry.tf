# Repositorio de imágenes de la aplicación. El despliegue continuo sube aquí la imagen del
# Dockerfile y Cloud Run la toma de aquí.
resource "google_artifact_registry_repository" "imagenes" {
  repository_id = local.nombre
  location      = var.region
  format        = "DOCKER"
  description   = "Imágenes de ${var.aplicacion}"

  # Limpieza para que el repositorio no crezca sin fin: se conservan las 10 versiones más
  # recientes y se borran las imágenes sin etiqueta de más de 7 días.
  cleanup_policy_dry_run = false

  cleanup_policies {
    id     = "conservar-recientes"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  cleanup_policies {
    id     = "borrar-sin-etiqueta"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "7d"
    }
  }

  depends_on = [google_project_service.apis]
}
