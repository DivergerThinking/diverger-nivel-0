#!/usr/bin/env bash
# Coste del job del worker para el bucle (HU-EJE-06, ADR 0024). Lo ejecuta el job, no el modelo, aunque el job
# falle o se cancele. INTENTOS trae, por cada paso del modelo, «resultado:coste» de las salidas de los pasos, que
# el código de las comprobaciones no puede cambiar. Los intentos 2 y 3 reanudan la sesión y su coste ya incluye lo
# anterior: vale el último, nunca la suma. Si un intento se lanzó y no dejó coste, no hay fichero y el bucle cuenta
# el tope entero: nunca se queda corto.
set -euo pipefail

mkdir -p "$RUNNER_TEMP/coste"
coste=""
for intento in ${INTENTOS:-}; do
  resultado=${intento%%:*}
  valor=${intento#*:}
  [ "$resultado" = skipped ] && continue
  [ -n "$valor" ] || exit 0
  coste=$valor
done
[ -n "$coste" ] || exit 0
jq -cn --argjson coste "$coste" '{costUsd: $coste}' > "$RUNNER_TEMP/coste/coste.json"
