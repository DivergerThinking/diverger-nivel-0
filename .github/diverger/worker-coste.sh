#!/usr/bin/env bash
# Coste del job del worker para el bucle (HU-EJE-06, ADR 0024). Lo ejecuta el job, no el modelo, aunque el job
# falle o se cancele. Los intentos 2 y 3 reanudan la sesión y su total_cost_usd ya incluye lo anterior, así que
# vale el mayor, nunca la suma; una sesión caída puede dejarlo a cero. Sin resultados no deja fichero, y el bucle
# cuenta el tope entero.
set -euo pipefail

mkdir -p "$RUNNER_TEMP/coste"
ls "$RUNNER_TEMP"/salida-[0-9].json >/dev/null 2>&1 || exit 0
jq -cs '{costUsd: (map(.total_cost_usd // 0) | max)}' "$RUNNER_TEMP"/salida-[0-9].json > "$RUNNER_TEMP/coste/coste.json"
