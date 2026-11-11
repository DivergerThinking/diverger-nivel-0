#!/usr/bin/env bash
# Coste del job del worker para el bucle (HU-EJE-06, ADR 0024). Lo ejecuta el job, no el modelo, aunque el job
# falle o se cancele. INTENTOS trae, por cada paso del modelo, «resultado:coste» de las salidas de los pasos, que
# el código de las comprobaciones no puede cambiar. Los intentos 2 y 3 reanudan la sesión y su coste ya incluye lo
# anterior: vale el mayor, nunca la suma. Si un intento se lanzó y no dejó coste, no hay fichero y el bucle cuenta
# el tope entero: nunca se queda corto. Si ningún intento se lanzó, el job no gastó nada y el coste es 0. La carpeta se vacía antes: un coste.json que ya estuviera, de quien fuera, no
# se sube nunca (harness#497).
set -euo pipefail

rm -rf "$RUNNER_TEMP/coste"
mkdir "$RUNNER_TEMP/coste"
coste=""
lanzados=0
for intento in ${INTENTOS:-}; do
  resultado=${intento%%:*}
  valor=${intento#*:}
  [ "$resultado" = skipped ] && continue
  lanzados=$((lanzados + 1))
  [ -n "$valor" ] || exit 0
  coste=$(awk -v a="${coste:-0}" -v b="$valor" 'BEGIN { print (b + 0 > a + 0 ? b : a) }')
done
[ -n "${INTENTOS:-}" ] || exit 0
[ "$lanzados" -gt 0 ] || coste=0
# Los Auditores de seguridad (HU-CAL-01) y los revisores de código (EN-OPS-08), que llegan en AUDITORES, son sesiones
# aparte: se suman. Uno lanzado sin coste, igual que un intento: no hay fichero y el bucle cuenta el tope entero.
for auditor in ${AUDITORES:-}; do
  resultado=${auditor%%:*}
  valor=${auditor#*:}
  [ "$resultado" = skipped ] && continue
  [ -n "$valor" ] || exit 0
  coste=$(awk -v a="$coste" -v b="$valor" 'BEGIN { print a + b }')
done
jq -cn --argjson coste "$coste" '{costUsd: $coste}' > "$RUNNER_TEMP/coste/coste.json"
