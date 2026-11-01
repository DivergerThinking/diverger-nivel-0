# Modelo inicial de Firestore (TA-077): una base de datos propia de la aplicación, en modo nativo
# y en la misma región que Cloud Run, sus índices compuestos y el permiso de la cuenta de
# ejecución sobre esa base y ninguna otra. La base (default) del proyecto no se usa: la comparten
# todas las aplicaciones del proyecto y no tendría un dueño claro.
resource "google_firestore_database" "datos" {
  name        = local.nombre
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  # Las transacciones bloquean lo que leen: es lo que pide una regla como «un equipo no se presta
  # dos veces» del nivel 1 (DISENO.md, «Por qué Firestore y no BigQuery»).
  concurrency_mode                  = "PESSIMISTIC"
  app_engine_integration_mode       = "DISABLED"
  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_DISABLED"

  delete_protection_state = var.proteccion_borrado ? "DELETE_PROTECTION_ENABLED" : "DELETE_PROTECTION_DISABLED"
  deletion_policy         = var.proteccion_borrado ? "ABANDON" : "DELETE"

  depends_on = [google_project_service.apis]
}

# Índices compuestos que piden las consultas de la aplicación. El arquitecto los añade a
# firestore.indexes.json; los de un solo campo los crea Firestore solo.
resource "google_firestore_index" "indices" {
  for_each = {
    for indice in local.indices :
    "${indice.collectionGroup}:${join(",", [for campo in indice.fields : "${campo.fieldPath}:${try(campo.order, campo.arrayConfig)}"])}" => indice
  }

  database    = google_firestore_database.datos.name
  collection  = each.value.collectionGroup
  query_scope = try(each.value.queryScope, "COLLECTION")

  dynamic "fields" {
    for_each = each.value.fields
    content {
      field_path   = fields.value.fieldPath
      order        = try(fields.value.order, null)
      array_config = try(fields.value.arrayConfig, null)
    }
  }
}

# La cuenta de ejecución lee y escribe en esta base y en ninguna otra del proyecto.
resource "google_project_iam_member" "datos" {
  project = var.proyecto
  role    = "roles/datastore.user"
  member  = "serviceAccount:${var.cuenta_ejecucion}"

  condition {
    title       = "solo-${local.nombre}"
    description = "Solo la base de Firestore de ${var.aplicacion}"
    expression  = "resource.name == \"projects/${var.proyecto}/databases/${local.nombre}\""
  }
}
