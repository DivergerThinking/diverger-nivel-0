# Infraestructura como código de la aplicación (EN-GP-03, ADR 0013 del harness), con OpenTofu.
# El estado va en un bucket de Cloud Storage: el bucket y el prefijo se dan al iniciar con
# -backend-config=staging.gcs.tfbackend, así que aquí no hay nombres de entorno ni credenciales.
terraform {
  required_version = ">= 1.12.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.6.0"
    }
  }

  backend "gcs" {}
}

# Las credenciales son las de quien aplica: su sesión de gcloud
# (gcloud auth application-default login) o Workload Identity en el CI. Nunca un fichero de claves.
provider "google" {
  project = var.proyecto
  region  = var.region

  default_labels = {
    aplicacion  = var.aplicacion
    gestionado  = "opentofu"
    golden-path = "diverger"
  }
}
