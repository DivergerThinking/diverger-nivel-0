output "url" {
  description = "URL del servicio de Cloud Run."
  value       = google_cloud_run_v2_service.aplicacion.uri
}

output "servicio" {
  description = "Nombre del servicio de Cloud Run, para gcloud run deploy."
  value       = google_cloud_run_v2_service.aplicacion.name
}

output "repositorio_imagenes" {
  description = "Ruta del repositorio de Artifact Registry para etiquetar las imágenes."
  value       = "${var.region}-docker.pkg.dev/${var.proyecto}/${google_artifact_registry_repository.imagenes.repository_id}"
}

output "base_de_datos" {
  description = "Base de Firestore de la aplicación (variable FIRESTORE_DATABASE del servicio)."
  value       = google_firestore_database.datos.name
}

output "cadena_despliegue" {
  description = "Cadena de Cloud Deploy de la aplicación (gcloud deploy releases create --delivery-pipeline)."
  value       = google_clouddeploy_delivery_pipeline.aplicacion.name
}
