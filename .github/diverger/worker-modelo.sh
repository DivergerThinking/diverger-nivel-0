#!/usr/bin/env bash
# Un intento del modelo en el worker (EN-FM-02, ADR 0016 del harness). Se ejecuta desde el checkout de la
# rama base, que el modelo no puede cambiar, y trabaja en el worktree de la tarea.
#
# Uso: worker-modelo.sh <intento>
#   1: lanza la skill diverger-dev:implement con la iniciativa y la tarea.
#   2 o más: sigue la misma sesión con la salida de las comprobaciones que fallaron en el intento anterior.
# Son los intentos dentro del job. INTENTO_BUCLE es el del bucle (ADR 0029 del harness): en el 2 y el 3, el primer
# intento del job recibe además el diagnóstico del job anterior ($RUNNER_TEMP/diagnostico-anterior.md).
# Si el modelo termina con «BLOQUEADA:», el intento falla con ese motivo; con «YA-CUBIERTA:», deja el motivo en
# $RUNNER_TEMP/cubierta (harness#538).
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

# Este paso tiene la clave de Anthropic: el PATH es fijo, con el Claude Code que instaló el job (CLAUDE_BIN, salida de
# su paso) y las herramientas del sistema, aunque algo haya añadido carpetas con GITHUB_PATH (harness#497).
[ -n "${CLAUDE_BIN:-}" ] && [ -x "$CLAUDE_BIN/claude" ] || fallar "No está Claude Code en ${CLAUDE_BIN:-?}"
export PATH="$CLAUDE_BIN:/usr/bin:/bin"

# El modelo no necesita pedir tokens de GitHub ni de GCP: se le quitan del entorno. Aunque los consiguiera,
# solo valen para la cuenta de telemetría, que solo escribe logs y métricas.
unset ACTIONS_ID_TOKEN_REQUEST_TOKEN ACTIONS_ID_TOKEN_REQUEST_URL GOOGLE_APPLICATION_CREDENTIALS \
  CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE GOOGLE_GHA_CREDS_PATH

# El tope es del job, no de cada intento (ADR 0024): --max-budget-usd no cuenta lo gastado antes de reanudar, así
# que cada intento recibe lo que queda, redondeado hacia abajo. TOPE_JOB y GASTADO llegan de las salidas de pasos anteriores, que el código de
# las comprobaciones no puede cambiar. Una sesión reanudada ya incluye el gasto anterior: es un total, no se suma.
tope="${TOPE_JOB:-$MAX_USD}"
gastado="${GASTADO:-0}"
restante=$(awk -v tope="$tope" -v gastado="$gastado" 'BEGIN { printf "%.2f", int((tope - gastado) * 100) / 100 }')
awk -v restante="$restante" 'BEGIN { exit !(restante >= 0.5) }' \
  || fallar "El worker ha gastado $gastado USD de su tope de $tope USD: no queda margen para otro intento"

if [ "$intento" = 1 ]; then
  instrucciones="Usa la skill diverger-dev:implement para construir la tarea $TAREA de la iniciativa $INICIATIVA."
  diagnostico=""
  [ -s "$RUNNER_TEMP/diagnostico-anterior.md" ] && diagnostico=$(head -c 12000 "$RUNNER_TEMP/diagnostico-anterior.md")
  case "${INTENTO_BUCLE:-1}" in
    2) instrucciones="$instrucciones

Es el segundo intento del bucle para esta tarea: un worker anterior falló. Empieza de cero: lo que hizo no está en la rama, no des nada por bueno de su razonamiento y vuelve a leer la tarea, su historia, el test de aceptación y el contrato. Este es su diagnóstico:

${diagnostico:-(no se ha podido leer)}" ;;
    3) instrucciones="$instrucciones

Es el tercer y último intento del bucle para esta tarea: dos workers anteriores fallaron. Replanifica antes de escribir: relee la especificación del contexto, el contrato y el test de aceptación, busca en los diagnósticos qué hizo fallar los intentos y construye lo mínimo que cumple cada criterio de aceptación, en pasos pequeños. Si la tarea no se puede hacer tal como está especificada, para con una línea «BLOQUEADA:» que diga qué hay que cambiar en el plan o en la especificación. Estos son los diagnósticos, del más reciente al primero:

${diagnostico:-(no se han podido leer)}" ;;
  esac
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
"$CLAUDE_BIN/claude" -p "$instrucciones" "${sesion[@]}" \
  --model "$MODELO" --permission-mode dontAsk \
  --plugin-dir "$PLUGIN_DEV" \
  --tools "Read,Glob,Grep,Edit,Write,Skill" \
  --allowedTools "Read" "Glob" "Grep" "Skill(diverger-dev:implement)" \
    "Edit(./src/**)" "Write(./src/**)" "Edit(./web/**)" "Write(./web/**)" \
    "Edit(./app/contextos.ts)" "Write(./app/contextos.ts)" \
  --setting-sources user --strict-mcp-config \
  --max-turns "$MAX_TURNOS" --max-budget-usd "$restante" \
  --output-format json > "$RUNNER_TEMP/salida-$intento.json"
codigo=$?
set -e
cp "$RUNNER_TEMP/salida-$intento.json" "$RUNNER_TEMP/salida.json"
# Antes de cualquier fallo del intento: error_max_budget_usd también trae su coste, y una sesión caída lo deja a cero.
coste=$(jq -r '.total_cost_usd // 0' "$RUNNER_TEMP/salida-$intento.json" 2>/dev/null || echo 0)
if [ -n "${GITHUB_OUTPUT:-}" ] && awk -v c="$coste" 'BEGIN { exit !(c > 0) }'; then
  echo "coste=$coste" >> "$GITHUB_OUTPUT"
fi
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
# La tarea ya estaba hecha por otra anterior (harness#538): el modelo lo dice en una línea y no cambia nada. Se guarda
# el motivo para que «Comprobar el resultado» abra una PR que solo marca la tarea. Solo vale el del último intento.
rm -f "$RUNNER_TEMP/cubierta"
cubierta=$(jq -r .result "$RUNNER_TEMP/salida-$intento.json" | grep -E '^(YA-CUBIERTA|ALREADY-DONE):' | head -1 || true)
if [ -n "$cubierta" ]; then
  printf '%s\n' "${cubierta:0:1000}" > "$RUNNER_TEMP/cubierta"
  echo "::notice::El worker dice que la tarea ya estaba cubierta: ${cubierta:0:300}"
fi
