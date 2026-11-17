#!/usr/bin/env bash
# Tarjeta de la tarea en sus GitHub Projects (HU-EJE-10, ADR 0063 del harness). Lo ejecuta el job del worker al empezar
# (in-progress) y al abrir la PR (in-review), y diverger-tarjeta.yml al integrarse la PR (done). Quien mueve la tarjeta
# es tarjetas.py del núcleo, descargado del harness; este script solo lo llama y anota su línea en
# $RUNNER_TEMP/tarjetas, para el resumen del job. Nunca falla: una tarjeta no para la ejecución.
#
# Entradas: la columna como argumento; INICIATIVA, TAREA, GITHUB_REPOSITORY y RUNNER_TEMP en el entorno; GH_TOKEN, el
# token de la App con permiso sobre los Projects (vacío si no se pudo pedir); TARJETAS_PY, la ruta de tarjetas.py.
set -uo pipefail

columna=${1:-}
case "$columna" in
  in-progress) nombre="En curso" ;;
  in-review) nombre="En revisión" ;;
  done) nombre="Hecho" ;;
  *) echo "Columna no válida: «$columna»"; exit 0 ;;
esac
registro="$RUNNER_TEMP/tarjetas"
script=${TARJETAS_PY:-}
if [ -z "${GH_TOKEN:-}" ]; then
  linea="No se ha podido pedir el token de la App para el Project: la tarjeta de $TAREA no se ha movido a $nombre. La App diverger-harness necesita el permiso de organización «Projects: Read and write»."
elif [ -z "$script" ] || [ ! -f "$script" ]; then
  linea="El núcleo descargado no tiene tarjetas.py (DIVERGER_HARNESS_REF anterior a HU-EJE-10): la tarjeta de $TAREA no se ha movido a $nombre."
else
  # tarjetas.py comprueba sus argumentos y siempre termina con 0; sus líneas empiezan por «Diverger · ».
  linea=$(python3 "$script" --repo "$GITHUB_REPOSITORY" --initiative "$INICIATIVA" --task "$TAREA" \
    --column "$columna" --project "${PROYECTO:-.}" 2>&1 | sed 's/^Diverger · //' | head -n 20)
  [ -n "$linea" ] || linea="tarjetas.py no ha dicho nada: la tarjeta de $TAREA puede no haberse movido a $nombre."
fi
printf '%s\n' "$linea" | tee -a "$registro"
exit 0
