#!/usr/bin/env bash
# Comprobaciones del proyecto después de un intento del modelo (EN-FM-02 y EN-EJE-03, ADR 0016 del harness).
# Las ejecuta el job, no el modelo, en un paso sin la clave de Anthropic: el código que ha escrito el modelo
# corre aquí con la red abierta, pero sin ningún secreto en el entorno. Se ejecuta desde el checkout de la
# rama base y trabaja en el worktree de la tarea.
#
# Uso: worker-comprobar.sh <intento>
# Deja la salida en $RUNNER_TEMP/comprobaciones-<intento>.log y el resultado (verde o rojo) en
# $RUNNER_TEMP/comprobaciones. Termina con 1 si están en rojo, para que el job lance el siguiente intento.
set -uo pipefail

intento="${1:?Falta el número de intento}"
[[ "$intento" =~ ^[1-9]$ ]] || { echo "::error::El intento «$intento» no es válido"; exit 2; }
log="$RUNNER_TEMP/comprobaciones-$intento.log"

# Lo que pudiera servir para pedir tokens o credenciales no llega a los procesos de las comprobaciones.
unset ACTIONS_ID_TOKEN_REQUEST_TOKEN ACTIONS_ID_TOKEN_REQUEST_URL GOOGLE_APPLICATION_CREDENTIALS \
  CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE GOOGLE_GHA_CREDS_PATH ANTHROPIC_API_KEY

cd "$WORKTREE" || { echo "::error::No existe el worktree $WORKTREE"; exit 2; }
{
  [ -d node_modules ] || npm ci --no-audit --no-fund
  npm run check
} > "$log" 2>&1
codigo=$?
if [ "$codigo" -eq 0 ]; then
  echo verde > "$RUNNER_TEMP/comprobaciones"
  echo "Comprobaciones en verde en el intento $intento"
  exit 0
fi
echo rojo > "$RUNNER_TEMP/comprobaciones"
echo "::warning::Comprobaciones en rojo en el intento $intento (código $codigo)"
tail -n 60 "$log"
exit 1
