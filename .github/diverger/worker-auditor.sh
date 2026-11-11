#!/usr/bin/env bash
# El Auditor de seguridad revisa el cambio de un intento del worker (HU-CAL-01 del harness, ADR 0040). Se ejecuta
# desde el checkout de la rama base, que el modelo no puede cambiar, después de unas comprobaciones en verde.
#
# Uso: worker-auditor.sh <intento>
#
# Lanza el agente diverger-quality:auditor-seguridad con el diff del worktree contra la rama base, la constitución
# y el código. Solo lee (Read, Glob y Grep), en dontAsk y sin la configuración del repositorio. Deja:
# - en $RUNNER_TEMP/auditor el veredicto: comentar, bloquear o ninguno;
# - en $RUNNER_TEMP/auditor-<intento>.md, lo que dice en Markdown, para el intento siguiente y para la PR;
# - las salidas «veredicto» y «coste» del paso.
# Con «bloquear», sale con 1 y el job lanza otro intento del worker con la explotación. Sin veredicto (un error,
# una respuesta que no es el JSON o sin presupuesto), sale con 2, deja el motivo en $RUNNER_TEMP/motivo-auditor y
# la tarea no se integra: falla cerrado.
set -uo pipefail

intento="${1:?Falta el número de intento}"
# Mientras no se ha lanzado Claude, el paso no ha gastado nada: deja coste=0 para que el bucle no cuente el tope entero.
lanzado=false
sin_coste() { [ "$lanzado" = true ] || [ -z "${GITHUB_OUTPUT:-}" ] || echo "coste=0" >> "$GITHUB_OUTPUT"; }
fallar() {
  sin_coste
  printf '%s\n' "$1" > "$RUNNER_TEMP/motivo-auditor"
  echo ninguno > "$RUNNER_TEMP/auditor"
  [ -z "${GITHUB_OUTPUT:-}" ] || echo "veredicto=ninguno" >> "$GITHUB_OUTPUT"
  echo "::error::$1"
  exit 2
}
[[ "$intento" =~ ^[1-9]$ ]] || fallar "El intento «$intento» no es válido"
echo ninguno > "$RUNNER_TEMP/auditor"
[ -n "${PLUGIN_QUALITY:-}" ] && [ -f "$PLUGIN_QUALITY/agents/auditor-seguridad.md" ] \
  || fallar "No está el agente auditor-seguridad de diverger-quality en ${PLUGIN_QUALITY:-?}"
[ -n "${CLAUDE_BIN:-}" ] && [ -x "$CLAUDE_BIN/claude" ] || fallar "No está Claude Code en ${CLAUDE_BIN:-?}"

# El cambio del intento: lo que el worker ha dejado en las rutas que puede escribir, contra la rama base. Va fuera
# del worktree, en una carpeta que el Auditor solo puede leer. Si git falla, no se revisa nada y la tarea no pasa:
# un diff vacío por un error no puede valer como «sin cambios».
entrada="$RUNNER_TEMP/auditoria-$intento"
rm -rf "$entrada"
mkdir -p "$entrada"
rutas=()
for ruta in src web app/contextos.ts; do
  [ -e "$ruta" ] && rutas+=("$ruta")
done
if [ "${#rutas[@]}" -eq 0 ]; then
  echo comentar > "$RUNNER_TEMP/auditor"
  [ -z "${GITHUB_OUTPUT:-}" ] || echo "veredicto=comentar" >> "$GITHUB_OUTPUT"
  echo "Sin src/, web/ ni app/contextos.ts: nada que revisar"
  # También aquí deja su informe: si no, la PR enseñaría el de un intento anterior como si fuera el último (harness#598).
  printf '%s\n' "Sin src/, web/ ni app/contextos.ts: nada que revisar." > "$RUNNER_TEMP/auditor-$intento.md"
  sin_coste
  exit 0
fi
git add -A --intent-to-add -- "${rutas[@]}" || fallar "No se puede preparar el diff del intento $intento"
git diff HEAD -- "${rutas[@]}" > "$entrada/cambios.diff" || fallar "No se puede sacar el diff del intento $intento"
git reset --quiet -- "${rutas[@]}" || fallar "No se puede dejar el índice como estaba en el intento $intento"
if [ ! -s "$entrada/cambios.diff" ]; then
  echo comentar > "$RUNNER_TEMP/auditor"
  [ -z "${GITHUB_OUTPUT:-}" ] || echo "veredicto=comentar" >> "$GITHUB_OUTPUT"
  echo "Sin cambios en el código: nada que revisar"
  # También aquí deja su informe: si no, la PR enseñaría el de un intento anterior como si fuera el último (harness#598).
  printf '%s\n' "Sin cambios en el código: nada que revisar." > "$RUNNER_TEMP/auditor-$intento.md"
  sin_coste
  exit 0
fi

# Este paso tiene la clave de Anthropic: el PATH es fijo, con el Claude Code que instaló el job (harness#497).
export PATH="$CLAUDE_BIN:/usr/bin:/bin"
unset ACTIONS_ID_TOKEN_REQUEST_TOKEN ACTIONS_ID_TOKEN_REQUEST_URL GOOGLE_APPLICATION_CREDENTIALS \
  CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE GOOGLE_GHA_CREDS_PATH

# El tope es del job (ADR 0024): lo que ya gastaron el worker y los Auditores anteriores. GASTADO es el total de la
# sesión del worker; los Auditores son sesiones aparte y se suman. Como mucho 2 USD por revisión.
tope="${TOPE_JOB:-$MAX_USD}"
gastado=$(awk -v g="${GASTADO:-0}" -v a="${COSTES_AUDITOR:-}" 'BEGIN { n = split(a, v, " "); s = g + 0; for (i = 1; i <= n; i++) s += v[i]; print s }')
restante=$(awk -v tope="$tope" -v gastado="$gastado" 'BEGIN { r = int((tope - gastado) * 100) / 100; printf "%.2f", (r > 2 ? 2 : r) }')
awk -v restante="$restante" 'BEGIN { exit !(restante >= 0.3) }' \
  || fallar "No queda presupuesto para el Auditor de seguridad ($gastado USD de $tope USD): la tarea no se integra sin su revisión"

instrucciones="Revisa la seguridad del cambio de la tarea $TAREA de la iniciativa $INICIATIVA. El diff contra la rama base está en $entrada/cambios.diff; los ficheros completos, en el directorio de trabajo; la constitución, en spec/constitucion.md; la tarea, en .diverger/$INICIATIVA/tasks/$TAREA.json. Responde solo con tu JSON."

lanzado=true
"$CLAUDE_BIN/claude" -p "$instrucciones" \
  --agent diverger-quality:auditor-seguridad --plugin-dir "$PLUGIN_QUALITY" \
  --permission-mode dontAsk --tools "Read,Glob,Grep" --add-dir "$entrada" \
  --setting-sources user --strict-mcp-config \
  --max-turns 30 --max-budget-usd "$restante" \
  --output-format json > "$RUNNER_TEMP/auditor-$intento.json"
codigo=$?
coste=$(jq -r '.total_cost_usd // 0' "$RUNNER_TEMP/auditor-$intento.json" 2>/dev/null || echo 0)
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "coste=$coste" >> "$GITHUB_OUTPUT"
fi
[ "$codigo" -eq 0 ] || fallar "El Auditor de seguridad terminó con el código $codigo en el intento $intento"

# El JSON del veredicto, aunque venga entre ```json y ```. Lo escribió un modelo que ha leído el código del worker: se
# valida su forma y nunca se ejecuta ni se pega en un script.
respuesta=$(jq -r '.result // ""' "$RUNNER_TEMP/auditor-$intento.json")
veredicto_json=$(python3 - "$respuesta" <<'PY'
import json, re, sys
texto = sys.argv[1].strip()
m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", texto, re.S)
try:
    datos = json.loads(m.group(1) if m else texto)
except ValueError:
    sys.exit(1)
if not isinstance(datos, dict) or datos.get("veredicto") not in ("bloquear", "comentar"):
    sys.exit(1)
bloqueos = datos.get("bloqueos") or []
comentarios = datos.get("comentarios") or []
if not isinstance(bloqueos, list) or not isinstance(comentarios, list):
    sys.exit(1)
if (datos["veredicto"] == "bloquear") != bool(bloqueos):
    sys.exit(1)
print(json.dumps({"veredicto": datos["veredicto"], "bloqueos": bloqueos, "comentarios": comentarios}, ensure_ascii=False))
PY
) || fallar "El Auditor de seguridad no ha respondido con su JSON en el intento $intento"

veredicto=$(jq -r .veredicto <<< "$veredicto_json")
jq -r '
  def linea(f; l): "`\(f // "?")`" + (if l then ":\(l)" else "" end);
  (if .veredicto == "bloquear" then "**El Auditor de seguridad bloquea el cambio.** Corrige cada fallo para que la explotación deje de funcionar:\n" else "**Auditor de seguridad:** sin fallos explotables.\n" end),
  (.bloqueos[] | "- \(.tipo // "?") en \(linea(.fichero; .linea)): \(.problema // "")\n  - Petición: \(.explotacion.peticion // "?")\n  - Sesión: \(.explotacion.sesion // "?")\n  - Resultado: \(.explotacion.resultado // "?")"),
  (if (.comentarios | length) > 0 then "\nComentarios, que no bloquean:" else empty end),
  (.comentarios[] | "- \(linea(.fichero; .linea)): \(.texto // "")")
' <<< "$veredicto_json" | head -c 8000 > "$RUNNER_TEMP/auditor-$intento.md"
echo "$veredicto" > "$RUNNER_TEMP/auditor"
echo "$veredicto" > "$RUNNER_TEMP/veredicto-$intento"
[ -z "${GITHUB_OUTPUT:-}" ] || echo "veredicto=$veredicto" >> "$GITHUB_OUTPUT"

# Lo escribió un modelo que ha leído el código del worker: sin órdenes de workflow mientras se imprime (harness#81).
fin="$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
echo "::stop-commands::$fin"
cat "$RUNNER_TEMP/auditor-$intento.md"
echo "::$fin::"

if [ "$veredicto" = bloquear ]; then
  echo rojo > "$RUNNER_TEMP/comprobaciones"
  exit 1
fi
exit 0
