#!/usr/bin/env bash
# Comprobaciones del proyecto después de un intento del modelo (EN-FM-02 y EN-EJE-03, ADR 0016 del harness).
# Las ejecuta el job, no el modelo, en un paso sin la clave de Anthropic. Se ejecuta desde el checkout de la rama
# base y trabaja en el worktree de la tarea.
#
# El código que ha escrito el modelo (sus tests, sus scripts de npm) corre aquí. Por eso corre en un contenedor
# (harness#497) que solo monta el worktree, con el usuario del runner, sin capacidades y solo con las variables que se
# le pasan: no ve los ficheros de comandos del runner (GITHUB_ENV, GITHUB_PATH, GITHUB_OUTPUT), ni RUNNER_TEMP (las
# salidas del modelo, el coste, el resultado), ni el checkout de la rama base (estos scripts), ni sudo ni docker. Así
# no puede cambiar el tope, el coste ni lo que ejecutan los pasos siguientes, que tienen la clave.
#
# Además (auditoría de seguridad del harness, harness#81):
# - npm run check corre sin red. Solo npm ci tiene red, y instala lo que dice el package-lock.json de la rama base:
#   antes de cada intento se deshace cualquier cambio fuera de las rutas que el modelo puede escribir.
# - El fichero .git del worktree se guarda en el primer intento y se repone siempre desde esa copia, también si el
#   paso muere por tiempo, y el contenedor se para por su nombre.
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
# En rojo hasta que se demuestre lo contrario: si el script para antes de terminar, no queda un verde de antes.
echo rojo > "$RUNNER_TEMP/comprobaciones"

# El fichero .git del worktree dice a git dónde está el repositorio. El contenedor puede cambiarlo, y con un
# repositorio suyo (core.fsmonitor, hooks) el git de los pasos siguientes ejecutaría su código. Se guarda en el primer
# intento, antes de que corra nada del modelo, y se repone siempre desde esa copia.
copia_gitdir="$RUNNER_TEMP/gitdir-worktree"
[ -s "$copia_gitdir" ] || cat "$WORKTREE/.git" > "$copia_gitdir"
contenedor="comprobaciones-$intento-$$"
reponer() {
  docker rm -f "$contenedor" > /dev/null 2>&1 || true
  rm -rf "$WORKTREE/.git"
  cat "$copia_gitdir" > "$WORKTREE/.git"
}
trap reponer EXIT
reponer

# Rutas que el modelo puede escribir (--allowedTools de worker-modelo.sh). Lo demás vuelve a como está en la rama:
# así npm ci no ejecuta un package.json, ni npm run check una configuración, que haya cambiado un intento anterior.
git_seguro() { git -C "$WORKTREE" -c core.fsmonitor=false -c core.hooksPath=/dev/null "$@"; }
fuera=(. ':(exclude)src' ':(exclude)web' ':(exclude)app/contextos.ts')
limpiar_fuera() {
  if ! git_seguro checkout -q HEAD -- "${fuera[@]}" || ! git_seguro clean -q -f -d -- "${fuera[@]}"; then
    echo "::error::No se puede deshacer lo que hay fuera de src/, web/ y app/contextos.ts en el worktree"
    exit 2
  fi
}
limpiar_fuera

ejecutar() {  # ejecutar <red> <orden>
  docker run --rm --name "$contenedor" --pull missing --network "$1" \
    --user "$(id -u):$(id -g)" --cap-drop ALL --security-opt no-new-privileges \
    -e HOME=/tmp -e CI=true -e npm_config_cache=/tmp/.npm -e npm_config_update_notifier=false \
    -v "$WORKTREE:/trabajo" -w /trabajo \
    "$IMAGEN_COMPROBACIONES" bash -c "$2"
}
# Solo la instalación tiene red; las comprobaciones, que ejecutan el código del modelo, no.
codigo=0
if [ ! -d "$WORKTREE/node_modules" ]; then
  ejecutar bridge 'npm ci --no-audit --no-fund' > "$log" 2>&1 || codigo=$?
fi
if [ "$codigo" -eq 0 ]; then
  ejecutar none 'npm run check' >> "$log" 2>&1 || codigo=$?
fi
reponer
limpiar_fuera  # Lo que las comprobaciones dejen fuera de esas rutas no llega a la PR.

if [ "$codigo" -eq 0 ]; then
  echo verde > "$RUNNER_TEMP/comprobaciones"
  echo "Comprobaciones en verde en el intento $intento"
  exit 0
fi
echo rojo > "$RUNNER_TEMP/comprobaciones"
echo "::warning::Comprobaciones en rojo en el intento $intento (código $codigo)"
# El log lo escribe el código del modelo: sin órdenes de workflow (::add-mask::, ::error::...) mientras se imprime.
fin="$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
echo "::stop-commands::$fin"
tail -n 60 "$log"
echo "::$fin::"
exit 1
