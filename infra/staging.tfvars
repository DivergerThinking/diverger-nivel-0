# Entorno de staging en el proyecto de pruebas del harness. Nada de esto es secreto.
# Una aplicación creada desde la plantilla cambia «aplicacion» por su nombre (y el prefijo de
# staging.gcs.tfbackend, para que su estado no pise el de otra).
proyecto         = "diverger-exp-harness"
region           = "europe-west1"
aplicacion       = "nivel-0"
cuenta_ejecucion = "diverger-run@diverger-exp-harness.iam.gserviceaccount.com"

# Despliegue continuo con Cloud Deploy (EN-FM-04): la cuenta y el almacén los crea gcp.sh del harness.
cuenta_cloud_deploy  = "diverger-clouddeploy@diverger-exp-harness.iam.gserviceaccount.com"
almacen_cloud_deploy = "gs://diverger-exp-harness-clouddeploy"

# Las aplicaciones de prueba se crean y se tiran en cada ejecución del nivel 0 y del nivel 1.
proteccion_borrado = false

# Inicio de sesión con Google (ADR 0004 del harness): el ID del cliente OAuth «Aplicación web» del
# proyecto de pruebas, el mismo para todas las aplicaciones de staging. No es un secreto. Sin él, la
# API protegida responde 503, y el validador en staging, que pide un token de identidad con esta
# audiencia, no puede entrar (EN-FM-03, ADR 0020 del harness). El cliente se crea en la consola de
# Google Cloud (Google Auth Platform > Clientes), con audiencia interna. Cada aplicación de staging
# añade su URL a los orígenes autorizados de JavaScript del cliente; sin ella, el botón de inicio de
# sesión no funciona en el navegador (el validador no lo necesita).
google_client_id = "856958240211-9odcnq6f4roe1er15rijo624ht8ekjmd.apps.googleusercontent.com"
