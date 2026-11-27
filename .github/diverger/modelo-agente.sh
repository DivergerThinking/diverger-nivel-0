#!/usr/bin/env bash
# El modelo de un agente del harness que corre en un job (harness#1107): el que fija el proyecto en
# .diverger/settings.json, en models.<clave>, o, si no lo fija, el que trae el agente en su cabecera, que es el modelo
# por defecto que propone el harness (Opus para el auditor de seguridad y el analista de bloqueos, Sonnet para el
# revisor de código).
#
# Uso: modelo-agente.sh <copia del agente> <clave de models>
#
# Cambia la línea «model:» de la copia del agente que el job ha montado en su plugin, nunca la del núcleo. Así manda el
# ajuste sin depender de si --model de Claude Code pisa el modelo de la cabecera de un agente. El modelo es un dato del
# proyecto: se valida antes de escribirlo. Sale con 1, y el job no sigue, si el ajuste no es válido.
set -euo pipefail

agente="${1:?Falta la copia del agente}"
clave="${2:?Falta la clave de models}"
[[ "$clave" =~ ^[A-Za-z]{1,40}$ ]] || { echo "::error::La clave «$clave» no es válida"; exit 1; }
[ -f "$agente" ] || { echo "::error::No está el agente $agente"; exit 1; }
modelo=""
if [ -f .diverger/settings.json ]; then
  modelo=$(jq -r --arg c "$clave" '.models[$c] // empty' .diverger/settings.json 2>/dev/null) \
    || { echo "::error::.diverger/settings.json no es JSON válido"; exit 1; }
fi
if [ -z "$modelo" ]; then
  echo "Modelo de $(basename "$agente" .md): $(sed -n 's/^model: *//p' "$agente" | head -1) (el del harness)"
  exit 0
fi
[[ "$modelo" =~ ^[a-z0-9][a-z0-9.-]{0,63}$ ]] || { echo "::error::El modelo de models.$clave «$modelo» no es válido"; exit 1; }
grep -q '^model:' "$agente" || { echo "::error::El agente $agente no tiene la línea model:"; exit 1; }
sed -i "0,/^model:.*/s//model: $modelo/" "$agente"
echo "Modelo de $(basename "$agente" .md): $modelo (models.$clave del proyecto)"
