#!/usr/bin/env bash
# Análisis de las tareas bloqueadas al parar el bucle (HU-EJE-11 y ADR 0078 del harness). El bucle no ejecuta ningún
# modelo (ADR 0016): esto va en el job «analisis» de diverger-bucle.yml, aparte, y solo si el bucle dejó tareas
# bloqueadas. bloqueos.py pendientes del núcleo ya escribió una entrada por tarea en $ANALISIS.
#
# Uso:
#   bucle-analisis.sh analizar   Lanza el agente diverger:analista-bloqueos con cada entrada. Es el único paso con la
#                                clave de Anthropic: no tiene token de GitHub ni de GCP. Solo lee (Read, Glob y Grep),
#                                en dontAsk y sin la configuración del repositorio, con un tope por tarea.
#   bucle-analisis.sh registrar  Valida cada respuesta con bloqueos.py registrar, comenta la corrección en la issue de la
#                                tarea bloqueada con el GITHUB_TOKEN del job y deja las filas en $ANALISIS/filas.jsonl.
#                                Sin clave de Anthropic.
# Si una tarea falla, se dice y se sigue con las demás: el análisis no puede tumbar el job, y el bloqueo se queda
# «pendiente de corrección» en el registro.
set -uo pipefail

modo="${1:?Falta el modo: analizar o registrar}"
: "${ANALISIS:?Falta la carpeta del análisis}"
: "${TAREAS:?Faltan las tareas bloqueadas}"
# Como mucho 5 tareas por parada, con 1 USD cada una: el análisis no puede gastar más que la construcción.
MAX_TAREAS=5
TOPE_TAREA="1.00"

tareas=()
for tarea in $TAREAS; do
  [[ "$tarea" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]] || { echo "::warning::La tarea «$tarea» no es válida: no se analiza"; continue; }
  [ -f "$ANALISIS/$tarea.json" ] || { echo "::warning::No está la entrada de $tarea"; continue; }
  tareas+=("$tarea")
done
if [ "${#tareas[@]}" -gt "$MAX_TAREAS" ]; then
  echo "::warning::Hay ${#tareas[@]} tareas bloqueadas: se analizan las $MAX_TAREAS primeras"
  tareas=("${tareas[@]:0:$MAX_TAREAS}")
fi

if [ "$modo" = analizar ]; then
  [ -n "${PLUGIN_NUCLEO:-}" ] && [ -f "$PLUGIN_NUCLEO/agents/analista-bloqueos.md" ] \
    || { echo "::error::No está el agente analista-bloqueos del núcleo en ${PLUGIN_NUCLEO:-?}"; exit 1; }
  [ -n "${CLAUDE_BIN:-}" ] && [ -x "$CLAUDE_BIN/claude" ] || { echo "::error::No está Claude Code en ${CLAUDE_BIN:-?}"; exit 1; }
  # Este paso tiene la clave de Anthropic: el PATH es fijo, con el Claude Code que instaló el job (harness#497).
  export PATH="$CLAUDE_BIN:/usr/bin:/bin"
  unset GH_TOKEN GITHUB_TOKEN ACTIONS_ID_TOKEN_REQUEST_TOKEN ACTIONS_ID_TOKEN_REQUEST_URL GOOGLE_APPLICATION_CREDENTIALS \
    CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE GOOGLE_GHA_CREDS_PATH
  for tarea in "${tareas[@]}"; do
    instrucciones="Analiza el bloqueo de la tarea $tarea. Su entrada está en $ANALISIS/$tarea.json; el plan y el código, en el directorio de trabajo. Responde solo con tu JSON."
    "$CLAUDE_BIN/claude" -p "$instrucciones" \
      --agent diverger:analista-bloqueos --plugin-dir "$PLUGIN_NUCLEO" \
      --permission-mode dontAsk --tools "Read,Glob,Grep" --add-dir "$ANALISIS" \
      --setting-sources user --strict-mcp-config \
      --max-turns 20 --max-budget-usd "$TOPE_TAREA" \
      --output-format json > "$ANALISIS/$tarea-claude.json"
    codigo=$?
    coste=$(jq -r '.total_cost_usd // 0' "$ANALISIS/$tarea-claude.json" 2>/dev/null || echo 0)
    if [ "$codigo" -eq 0 ]; then
      echo "Analizada $tarea ($coste USD)"
    else
      echo "::warning::El análisis de $tarea terminó con el código $codigo ($coste USD)"
    fi
  done
  exit 0
fi

[ "$modo" = registrar ] || { echo "::error::El modo «$modo» no existe"; exit 1; }
: "${NUCLEO:?Falta la carpeta del núcleo}"
: > "$ANALISIS/filas.jsonl"
for tarea in "${tareas[@]}"; do
  [ -f "$ANALISIS/$tarea-claude.json" ] || { echo "::warning::$tarea no tiene análisis"; continue; }
  python3 "$NUCLEO/plugins/diverger/server/bloqueos.py" registrar --entrada "$ANALISIS/$tarea.json" \
    --respuesta "$ANALISIS/$tarea-claude.json" --repo "$GITHUB_REPOSITORY" --out "$ANALISIS" \
    || { echo "::warning::El análisis de $tarea no vale: su bloqueo sigue pendiente de corrección"; continue; }
  cat "$ANALISIS/$tarea-fila.json" >> "$ANALISIS/filas.jsonl"
  echo >> "$ANALISIS/filas.jsonl"
  # Solo la issue de una tarea bloqueada de este repositorio: la entrada sale de run.json, que es un dato.
  issue=$(jq -r '.issue // empty' "$ANALISIS/$tarea.json")
  if [[ "$issue" =~ ^https://github\.com/${GITHUB_REPOSITORY}/issues/[0-9]+$ ]]; then
    gh issue comment "$issue" --body-file "$ANALISIS/$tarea-comentario.md" > /dev/null \
      && echo "Comentada la corrección de $tarea en $issue" \
      || echo "::warning::No se ha podido comentar en $issue"
  else
    echo "::warning::$tarea no tiene issue de este repositorio: la corrección solo va al registro"
  fi
done
echo "Filas del análisis: $(grep -c . "$ANALISIS/filas.jsonl" || true)"
