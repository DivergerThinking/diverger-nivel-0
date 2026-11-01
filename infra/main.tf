locals {
  # Las tres piezas llevan el nombre de la aplicación, para encontrarlas juntas en la consola.
  nombre = var.aplicacion

  # Índices compuestos de Firestore, en el formato de firestore.indexes.json de Firebase.
  indices = jsondecode(file("${path.module}/${var.fichero_indices}")).indexes
}

# Las API que usa la aplicación; Cloud Deploy prepara y despliega cada versión con Cloud Build. En el proyecto del harness ya las activa gcp.sh; se declaran
# para que la infraestructura también funcione en un proyecto nuevo. Al destruir no se apagan:
# otras aplicaciones del mismo proyecto las usan.
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "firestore.googleapis.com",
    "artifactregistry.googleapis.com",
    "clouddeploy.googleapis.com",
    "cloudbuild.googleapis.com",
  ])

  service            = each.value
  disable_on_destroy = false
}
