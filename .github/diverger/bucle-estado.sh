#!/usr/bin/env bash
# Recupera el estado del bucle de una iniciativa (ADR 0024 y harness#498): el run.json que guardó la última ejecución
# de diverger-bucle.yml en la rama base, en el artefacto diverger-bucle-<iniciativa>. run.json no se versiona: sin
# esto, relanzar el bucle en un job nuevo pondría el gasto a cero.
#
# - Solo vale un artefacto de una ejecución de este workflow en la rama base: un workflow de una PR podría subir otro
#   con el mismo nombre.
# - Se busca entre todos los artefactos con ese nombre, no entre las últimas ejecuciones: las de otras iniciativas no
#   lo esconden. Vale también el de la ejecución en curso, que deja su intento anterior si se relanza con «Re-run».
# - Cualquier error de GitHub para el job: seguir sin el estado pondría el gasto a cero, y el run.json nuevo taparía
#   el bueno en el siguiente lanzamiento. Solo «no hay ningún artefacto» es empezar de cero.
#
# Uso, desde la raíz del proyecto: bucle-estado.sh. Necesita INICIATIVA, GITHUB_REPOSITORY, GITHUB_REF_NAME y GH_TOKEN.
set -euo pipefail

fallar() { echo "::error::No se puede recuperar el estado del bucle: $1"; exit 1; }

[[ "${INICIATIVA:-}" =~ ^[a-z0-9][a-z0-9-]{0,63}$ ]] || fallar "la iniciativa «${INICIATIVA:-}» no es válida"
nombre="diverger-bucle-$INICIATIVA"
destino=".diverger/$INICIATIVA/run.json"

ejecuciones=$(gh api --paginate "repos/$GITHUB_REPOSITORY/actions/workflows/diverger-bucle.yml/runs?branch=$GITHUB_REF_NAME&per_page=100" \
  --jq '.workflow_runs[].id') || fallar "GitHub no ha dado las ejecuciones de diverger-bucle.yml"
artefactos=$(gh api --paginate "repos/$GITHUB_REPOSITORY/actions/artifacts?name=$nombre&per_page=100" \
  --jq '.artifacts[] | select(.expired | not) | "\(.created_at) \(.workflow_run.id)"') \
  || fallar "GitHub no ha dado los artefactos $nombre"

# El más reciente primero: las fechas ISO se ordenan como texto.
while read -r _ ejecucion; do
  [ -n "$ejecucion" ] && grep -qxF "$ejecucion" <<< "$ejecuciones" || continue
  temporal=$(mktemp -d)
  gh run download "$ejecucion" -R "$GITHUB_REPOSITORY" -n "$nombre" -D "$temporal" \
    || fallar "no se ha podido descargar $nombre de la ejecución $ejecucion"
  jq -e 'type == "object"' "$temporal/run.json" >/dev/null 2>&1 || fallar "el run.json de la ejecución $ejecucion no es válido"
  mkdir -p "$(dirname "$destino")"
  cp "$temporal/run.json" "$destino"
  echo "Estado del bucle de $INICIATIVA recuperado de la ejecución $ejecucion"
  exit 0
done < <(sort -r <<< "$artefactos")

echo "No hay estado anterior del bucle de $INICIATIVA: empieza de cero"
