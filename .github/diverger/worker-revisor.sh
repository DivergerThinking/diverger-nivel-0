#!/usr/bin/env bash
# El revisor de código revisa el cambio de un intento del worker frente a los criterios de su tarea (EN-OPS-08 y ADR
# 0008 del harness). Se ejecuta desde el checkout de la rama base, que el modelo no puede cambiar, después de unas
# comprobaciones en verde y de un Auditor de seguridad que no bloquea.
#
# Uso: worker-revisor.sh <intento>
#
# Lanza el agente diverger:revisor-codigo con el diff del worktree contra la rama base, la tarea y el test de
# aceptación de su historia. Solo lee (Read, Glob y Grep), en dontAsk y sin la configuración del repositorio. Deja:
# - en $RUNNER_TEMP/revisor el veredicto: aprueba, bloquea o ninguno;
# - en $RUNNER_TEMP/revisor-<intento>.md, lo que dice en Markdown, para el intento siguiente y para la PR;
# - en $RUNNER_TEMP/veredicto-<intento>, «bloquea» si bloquea, para que el intento siguiente sepa qué corregir;
# - las salidas «veredicto» y «coste» del paso.
# Con «bloquea», sale con 1 y el job lanza otro intento del worker con la prueba del fallo. Sin veredicto (un error,
# una respuesta que no es el JSON o sin presupuesto), sale con 2, deja el motivo en $RUNNER_TEMP/motivo-revisor y la
# tarea no se integra: falla cerrado. Con «aprueba», «Rama y PR» publica el estado revisor-codigo en el commit de la
# PR, que el job «revisor» del CI exige con la política automática.
set -uo pipefail

intento="${1:?Falta el número de intento}"
# Mientras no se ha lanzado Claude, el paso no ha gastado nada: deja coste=0 para que el bucle no cuente el tope entero.
lanzado=false
sin_coste() { [ "$lanzado" = true ] || [ -z "${GITHUB_OUTPUT:-}" ] || echo "coste=0" >> "$GITHUB_OUTPUT"; }
fallar() {
  sin_coste
  printf '%s\n' "$1" > "$RUNNER_TEMP/motivo-revisor"
  echo ninguno > "$RUNNER_TEMP/revisor"
  [ -z "${GITHUB_OUTPUT:-}" ] || echo "veredicto=ninguno" >> "$GITHUB_OUTPUT"
  echo "::error::$1"
  exit 2
}
aprobar_sin_revisar() {
  echo aprueba > "$RUNNER_TEMP/revisor"
  [ -z "${GITHUB_OUTPUT:-}" ] || echo "veredicto=aprueba" >> "$GITHUB_OUTPUT"
  echo "$1"
  # También aquí deja su informe: si no, la PR enseñaría el de un intento anterior como si fuera el último.
  printf '%s\n' "$1." > "$RUNNER_TEMP/revisor-$intento.md"
  sin_coste
  exit 0
}
[[ "$intento" =~ ^[1-9]$ ]] || fallar "El intento «$intento» no es válido"
echo ninguno > "$RUNNER_TEMP/revisor"
[ -n "${PLUGIN_NUCLEO:-}" ] && [ -f "$PLUGIN_NUCLEO/agents/revisor-codigo.md" ] \
  || fallar "No está el agente revisor-codigo del núcleo en ${PLUGIN_NUCLEO:-?}"
[ -n "${CLAUDE_BIN:-}" ] && [ -x "$CLAUDE_BIN/claude" ] || fallar "No está Claude Code en ${CLAUDE_BIN:-?}"
[ -n "${FICHERO_TAREA:-}" ] && [ -f "$FICHERO_TAREA" ] || fallar "No está el fichero de la tarea ${FICHERO_TAREA:-?}"

# La historia de la tarea da su test de aceptación. Es un dato del plan: se valida antes de usarlo en una ruta.
historia=$(jq -r '.story // empty' "$FICHERO_TAREA" 2>/dev/null) || historia=""
[[ "$historia" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]] || fallar "La tarea no tiene una historia válida en story"
criterios="tests/aceptacion/$historia.feature"
[ -f "$criterios" ] || fallar "No está el test de aceptación de la historia $historia ($criterios): el revisor no tendría criterios"

# El cambio del intento, como el del Auditor: lo que el worker ha dejado en las rutas que puede escribir, contra la
# rama base, fuera del worktree. Si git falla, no se revisa nada y la tarea no pasa.
entrada="$RUNNER_TEMP/revision-$intento"
rm -rf "$entrada"
mkdir -p "$entrada"
rutas=()
for ruta in src web app/contextos.ts; do
  [ -e "$ruta" ] && rutas+=("$ruta")
done
[ "${#rutas[@]}" -gt 0 ] || aprobar_sin_revisar "Sin src/, web/ ni app/contextos.ts: nada que revisar"
git add -A --intent-to-add -- "${rutas[@]}" || fallar "No se puede preparar el diff del intento $intento"
git diff HEAD -- "${rutas[@]}" > "$entrada/cambios.diff" || fallar "No se puede sacar el diff del intento $intento"
git reset --quiet -- "${rutas[@]}" || fallar "No se puede dejar el índice como estaba en el intento $intento"
[ -s "$entrada/cambios.diff" ] || aprobar_sin_revisar "Sin cambios en el código: nada que revisar"

# Este paso tiene la clave de Anthropic: el PATH es fijo, con el Claude Code que instaló el job (harness#497).
export PATH="$CLAUDE_BIN:/usr/bin:/bin"
unset ACTIONS_ID_TOKEN_REQUEST_TOKEN ACTIONS_ID_TOKEN_REQUEST_URL GOOGLE_APPLICATION_CREDENTIALS \
  CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE GOOGLE_GHA_CREDS_PATH

# El tope es del job (ADR 0024): lo que ya gastaron el worker, los Auditores y los revisores anteriores. GASTADO es el
# total de la sesión del worker; las revisiones (COSTES_AUDITOR) son sesiones aparte y se suman. Como mucho 2 USD.
tope="${TOPE_JOB:-$MAX_USD}"
gastado=$(awk -v g="${GASTADO:-0}" -v a="${COSTES_AUDITOR:-}" 'BEGIN { n = split(a, v, " "); s = g + 0; for (i = 1; i <= n; i++) s += v[i]; print s }')
restante=$(awk -v tope="$tope" -v gastado="$gastado" 'BEGIN { r = int((tope - gastado) * 100) / 100; printf "%.2f", (r > 2 ? 2 : r) }')
awk -v restante="$restante" 'BEGIN { exit !(restante >= 0.3) }' \
  || fallar "No queda presupuesto para el revisor de código ($gastado USD de $tope USD): la tarea no se integra sin su revisión"

instrucciones="Revisa el cambio de la tarea $TAREA de la iniciativa $INICIATIVA. La tarea está en $FICHERO_TAREA; sus criterios de aceptación, en $criterios; el diff contra la rama base, en $entrada/cambios.diff; los ficheros completos, en el directorio de trabajo. Responde solo con tu JSON."

lanzado=true
"$CLAUDE_BIN/claude" -p "$instrucciones" \
  --agent diverger:revisor-codigo --plugin-dir "$PLUGIN_NUCLEO" \
  --permission-mode dontAsk --tools "Read,Glob,Grep" --add-dir "$entrada" \
  --setting-sources user --strict-mcp-config \
  --max-turns 30 --max-budget-usd "$restante" \
  --output-format json > "$RUNNER_TEMP/revisor-$intento.json"
codigo=$?
coste=$(jq -r '.total_cost_usd // 0' "$RUNNER_TEMP/revisor-$intento.json" 2>/dev/null || echo 0)
[ -z "${GITHUB_OUTPUT:-}" ] || echo "coste=$coste" >> "$GITHUB_OUTPUT"
[ "$codigo" -eq 0 ] || fallar "El revisor de código terminó con el código $codigo en el intento $intento"

# El JSON del veredicto, aunque venga entre ```json y ```. Lo escribió un modelo que ha leído el código del worker: se
# valida su forma y nunca se ejecuta ni se pega en un script.
respuesta=$(jq -r '.result // ""' "$RUNNER_TEMP/revisor-$intento.json")
veredicto_json=$(python3 - "$respuesta" <<'PY'
import json, re, sys
texto = sys.argv[1].strip()
m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", texto, re.S)
try:
    datos = json.loads(m.group(1) if m else texto)
except ValueError:
    sys.exit(1)
if not isinstance(datos, dict) or datos.get("veredicto") not in ("aprueba", "bloquea"):
    sys.exit(1)
bloqueos = datos.get("bloqueos") or []
comentarios = datos.get("comentarios") or []
if not isinstance(bloqueos, list) or not isinstance(comentarios, list):
    sys.exit(1)
if not all(isinstance(b, dict) and b.get("motivo") in ("correccion", "requisitos") for b in bloqueos):
    sys.exit(1)
if (datos["veredicto"] == "bloquea") != bool(bloqueos):
    sys.exit(1)
print(json.dumps({"veredicto": datos["veredicto"], "bloqueos": bloqueos, "comentarios": comentarios}, ensure_ascii=False))
PY
) || fallar "El revisor de código no ha respondido con su JSON en el intento $intento"

veredicto=$(jq -r .veredicto <<< "$veredicto_json")
jq -r '
  def linea(f; l): "`\(f // "?")`" + (if l then ":\(l)" else "" end);
  def motivo(m): if m == "requisitos" then "Requisitos" else "Corrección" end;
  (if .veredicto == "bloquea" then "**El revisor de código bloquea el cambio.** Corrige cada fallo para que la prueba deje de fallar:\n" else "**Revisor de código:** sin fallos de corrección ni de requisitos.\n" end),
  (.bloqueos[] | "- \(motivo(.motivo)) en \(linea(.fichero; .linea)): \(.problema // "")\n  - Prueba: \(.prueba // "?")"),
  (if (.comentarios | length) > 0 then "\nComentarios, que no bloquean:" else empty end),
  (.comentarios[] | "- \(linea(.fichero; .linea)): \(.texto // "")")
' <<< "$veredicto_json" | head -c 8000 > "$RUNNER_TEMP/revisor-$intento.md"
echo "$veredicto" > "$RUNNER_TEMP/revisor"
[ "$veredicto" != bloquea ] || echo bloquea > "$RUNNER_TEMP/veredicto-$intento"
[ -z "${GITHUB_OUTPUT:-}" ] || echo "veredicto=$veredicto" >> "$GITHUB_OUTPUT"

# Lo escribió un modelo que ha leído el código del worker: sin órdenes de workflow mientras se imprime (harness#81).
fin="$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
echo "::stop-commands::$fin"
cat "$RUNNER_TEMP/revisor-$intento.md"
echo "::$fin::"

if [ "$veredicto" = bloquea ]; then
  echo rojo > "$RUNNER_TEMP/comprobaciones"
  exit 1
fi
exit 0
