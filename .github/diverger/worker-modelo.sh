#!/usr/bin/env bash
# Un intento del modelo en el worker (EN-FM-02, ADR 0016 del harness). Se ejecuta desde el checkout de la
# rama base, que el modelo no puede cambiar, y trabaja en el worktree de la tarea.
#
# Uso: worker-modelo.sh <intento>
#   1: lanza la skill diverger-dev:implement con la iniciativa y la tarea.
#   2 o más: sigue la misma sesión con la salida de las comprobaciones que fallaron en el intento anterior.
#
# Permisos del modelo:
# - Solo tiene la clave de Anthropic: ningún token de GitHub ni de GCP.
# - dontAsk: lo que no está permitido se deniega sin preguntar.
# - --tools: sin Bash, WebFetch ni WebSearch. El modelo no ejecuta nada ni sale a la red más que a la API de
#   Anthropic; las comprobaciones las ejecuta el job después, en otro paso y sin la clave.
# - --allowedTools: leer el repositorio, la skill de diverger-dev y escribir solo src/, web/ y
#   app/contextos.ts. Nunca spec/, tests/aceptacion/, .diverger/, .github/, infra/, lib/ ni los paquetes.
# - --setting-sources user y --strict-mcp-config: el repositorio no puede añadir permisos, hooks,
#   variables ni servidores MCP con su .claude/settings.json o su .mcp.json.
set -euo pipefail

fallar() { printf '%s\n' "$1" > "$RUNNER_TEMP/motivo"; echo "::error::$1"; exit 1; }

intento="${1:?Falta el número de intento}"
[[ "$intento" =~ ^[1-9]$ ]] || fallar "El intento «$intento» no es válido"
[ -n "${PLUGIN_DEV:-}" ] && [ -f "$PLUGIN_DEV/.claude-plugin/plugin.json" ] || fallar "No está el plugin diverger-dev en ${PLUGIN_DEV:-?}"

# El modelo no necesita pedir tokens de GitHub ni de GCP: se le quitan del entorno. Aunque los consiguiera,
# solo valen para la cuenta de telemetría, que solo escribe logs y métricas.
unset ACTIONS_ID_TOKEN_REQUEST_TOKEN ACTIONS_ID_TOKEN_REQUEST_URL GOOGLE_APPLICATION_CREDENTIALS \
  CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE GOOGLE_GHA_CREDS_PATH

if [ "$intento" = 1 ]; then
  instrucciones="Usa la skill diverger-dev:implement para construir la tarea $TAREA de la iniciativa $INICIATIVA."
  sesion=()
else
  anterior=$((intento - 1))
  id=$(jq -r '.session_id // empty' "$RUNNER_TEMP/salida-$anterior.json" 2>/dev/null || true)
  [ -n "$id" ] || fallar "No se encuentra la sesión del intento $anterior para seguirla"
  sesion=(--resume "$id")
  # Solo el final del log: es donde están los errores, y el resto gastaría contexto.
  instrucciones="Las comprobaciones del proyecto (npm run check) han fallado después de tu intento $anterior. Corrige la causa en el código o en tus tests, sin debilitar los tests de los criterios de aceptación ni desactivar reglas, y termina otra vez. Estas son las últimas líneas de su salida:

$(tail -n 150 "$RUNNER_TEMP/comprobaciones-$anterior.log")"
fi

set +e
claude -p "$instrucciones" "${sesion[@]}" \
  --model "$MODELO" --permission-mode dontAsk \
  --plugin-dir "$PLUGIN_DEV" \
  --tools "Read,Glob,Grep,Edit,Write,Skill" \
  --allowedTools "Read" "Glob" "Grep" "Skill(diverger-dev:implement)" \
    "Edit(./src/**)" "Write(./src/**)" "Edit(./web/**)" "Write(./web/**)" \
    "Edit(./app/contextos.ts)" "Write(./app/contextos.ts)" \
  --setting-sources user --strict-mcp-config \
  --max-turns "$MAX_TURNOS" --max-budget-usd "$MAX_USD" \
  --output-format json > "$RUNNER_TEMP/salida-$intento.json"
codigo=$?
set -e
cp "$RUNNER_TEMP/salida-$intento.json" "$RUNNER_TEMP/salida.json"
jq '{is_error, subtype, num_turns, total_cost_usd, result}' "$RUNNER_TEMP/salida-$intento.json" || true
echo "Herramientas denegadas:"
jq -r '.permission_denials[]? | "- \(.tool_name): \(.tool_input | tostring | .[0:200])"' "$RUNNER_TEMP/salida-$intento.json" || true
[ "$codigo" -eq 0 ] || fallar "Claude Code terminó con el código $codigo en el intento $intento"
tipo=$(jq -r .subtype "$RUNNER_TEMP/salida-$intento.json")
[ "$tipo" = success ] && [ "$(jq -r .is_error "$RUNNER_TEMP/salida-$intento.json")" = false ] \
  || fallar "El worker no terminó bien en el intento $intento ($tipo): error_max_turns y error_max_budget_usd son los topes"
if jq -r .result "$RUNNER_TEMP/salida-$intento.json" | grep -qE '^(BLOQUEADA|BLOCKED):'; then
  fallar "El worker se ha parado: $(jq -r .result "$RUNNER_TEMP/salida-$intento.json" | grep -E '^(BLOQUEADA|BLOCKED):' | head -1)"
fi
