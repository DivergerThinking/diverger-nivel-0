#!/usr/bin/env bash
# Comprobaciones del proyecto después de un intento del modelo (EN-FM-02 y EN-EJE-03, ADR 0016 del harness).
# Las ejecuta el job, no el modelo, en un paso sin la clave de Anthropic. Se ejecuta desde el checkout de la rama
# base y trabaja en el worktree de la tarea.
#
# El código que ha escrito el modelo (sus tests, sus scripts de npm) corre aquí con la red abierta. Por eso corre en
# un contenedor (harness#497) que solo monta el worktree, con el usuario del runner, sin capacidades y solo con las
# variables que se le pasan: no ve los ficheros de comandos del runner (GITHUB_ENV, GITHUB_PATH, GITHUB_OUTPUT), ni
# RUNNER_TEMP (las salidas del modelo, el coste, el resultado), ni el checkout de la rama base (estos scripts), ni
# sudo ni docker. Así no puede cambiar el tope, el coste ni lo que ejecutan los pasos siguientes, que tienen la clave.
#
# Uso: worker-comprobar.sh <intento>
# Deja la salida en $RUNNER_TEMP/comprobaciones-<intento>.log y el resultado (verde o rojo) en
# $RUNNER_TEMP/comprobaciones. Termina con 1 si están en rojo, para que el job lance el siguiente intento.
set -uo pipefail

intento="${1:?Falta el número de intento}"
[[ "$intento" =~ ^[1-9]$ ]] || { echo "::error::El intento «$intento» no es válido"; exit 2; }
log="$RUNNER_TEMP/comprobaciones-$intento.log"
[ -n "${IMAGEN_COMPROBACIONES:-}" ] || { echo "::error::Falta IMAGEN_COMPROBACIONES"; exit 2; }
[ -f "${WORKTREE:-}/.git" ] || { echo "::error::No existe el worktree ${WORKTREE:-?}"; exit 2; }

# El fichero .git del worktree dice a git dónde está el repositorio. El contenedor puede cambiarlo, y con un
# repositorio suyo (core.fsmonitor, hooks) el git de los pasos siguientes ejecutaría su código: se guarda y se repone.
gitdir=$(cat "$WORKTREE/.git")

docker run --rm --pull missing \
  --user "$(id -u):$(id -g)" --cap-drop ALL --security-opt no-new-privileges \
  -e HOME=/tmp -e CI=true -e npm_config_cache=/tmp/.npm -e npm_config_update_notifier=false \
  -v "$WORKTREE:/trabajo" -w /trabajo \
  "$IMAGEN_COMPROBACIONES" \
  bash -c '{ [ -d node_modules ] || npm ci --no-audit --no-fund; } && npm run check' > "$log" 2>&1
codigo=$?

rm -rf "$WORKTREE/.git"
printf '%s\n' "$gitdir" > "$WORKTREE/.git"

if [ "$codigo" -eq 0 ]; then
  echo verde > "$RUNNER_TEMP/comprobaciones"
  echo "Comprobaciones en verde en el intento $intento"
  exit 0
fi
echo rojo > "$RUNNER_TEMP/comprobaciones"
echo "::warning::Comprobaciones en rojo en el intento $intento (código $codigo)"
tail -n 60 "$log"
exit 1
