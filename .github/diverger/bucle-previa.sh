#!/usr/bin/env bash
# Comprobación previa de una ejecución desatendida (EN-GP-04, RQ.060, ADR 0049 del harness), antes de lanzar ningún
# worker: que el secreto ANTHROPIC_API_KEY no está vacío, que están las variables de GCP y que la federación de
# identidades de GCP deja entrar a este repositorio. Cada fallo dice la orden que lo arregla, y el resultado va al
# resumen del job.
#
# Uso, desde diverger-bucle.yml:
#   bucle-previa.sh secreto-y-variables   con CLAVE_ANTHROPIC (el secreto, solo en el env de ese paso) y las variables
#   bucle-previa.sh gcp <outcome>         con el resultado del paso que entra en GCP con la cuenta de telemetría
# Necesita GITHUB_REPOSITORY y GITHUB_STEP_SUMMARY. El valor del secreto nunca se imprime.
set -euo pipefail

# Las que usan los workflows de la aplicación y las que imprime infra/entornos/gcp.sh del harness para sus repositorios.
VARIABLES=(GCP_PROJECT_ID GCP_REGION GCP_WIF_PROVIDER GCP_DEPLOY_SA GCP_ARTIFACT_REPO GCP_TELEMETRY_SA)

resumen() { printf '%s\n' "$@" >> "$GITHUB_STEP_SUMMARY"; }
error() { echo "::error::$1"; resumen "- [!] $1. Para arreglarlo: \`$2\`"; }

case "${1:-}" in
  secreto-y-variables)
    resumen "## Comprobación previa" ""
    fallos=0
    if [ -z "${CLAVE_ANTHROPIC:-}" ]; then
      # GitHub da un valor vacío también si el secreto no existe.
      error "El secreto ANTHROPIC_API_KEY está vacío (o no existe)" "gh secret set ANTHROPIC_API_KEY --repo $GITHUB_REPOSITORY"
      fallos=$((fallos + 1))
    else
      resumen "- [OK] El secreto ANTHROPIC_API_KEY no está vacío"
    fi
    for variable in "${VARIABLES[@]}"; do
      if [ -z "${!variable:-}" ]; then
        error "Falta la variable $variable" "gh variable set $variable --repo $GITHUB_REPOSITORY"
        fallos=$((fallos + 1))
      fi
    done
    [ "$fallos" -gt 0 ] || resumen "- [OK] Están las variables ${VARIABLES[*]}"
    if [ "$fallos" -gt 0 ]; then
      resumen "" "La ejecución se para sin lanzar ningún worker."
      exit 1
    fi
    ;;
  gcp)
    if [ "${2:-}" = success ]; then
      resumen "- [OK] La federación de identidades de GCP deja entrar a $GITHUB_REPOSITORY con la cuenta de telemetría"
    else
      # El acceso de cada repositorio lo concede gcp.sh con REPOS: sin él, GCP no deja usar la cuenta desde aquí. Si la
      # orden no lo arregla, el motivo está en los valores de las variables o en la rama.
      error "La federación de identidades de GCP no responde para $GITHUB_REPOSITORY" \
        "PROJECT_ID=${GCP_PROJECT_ID:-<GCP_PROJECT_ID>} REPOS=${GITHUB_REPOSITORY#*/} ./infra/entornos/gcp.sh"
      resumen "" "La orden se ejecuta en el harness con una sesión de administración de GCP. Si ya lo tenía, comprueba:" \
        "- que GCP_WIF_PROVIDER y GCP_TELEMETRY_SA son los valores que imprime gcp.sh al terminar;" \
        "- que el bucle se lanza desde main: GCP solo acepta la cuenta desde los workflows de esa rama;" \
        "- el error del paso anterior, por si Google falló en ese momento." \
        "" "La ejecución se para sin lanzar ningún worker."
      exit 1
    fi
    resumen "" "La ejecución puede empezar."
    ;;
  *)
    echo "Uso: bucle-previa.sh secreto-y-variables | gcp <outcome>" >&2
    exit 2
    ;;
esac
