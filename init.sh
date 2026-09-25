#!/usr/bin/env bash
# init.sh - punto de entrada de verificacion.
# Ejecutalo al inicio de CADA sesion, antes de escribir codigo.
# Crece con el proyecto: mientras no haya codigo, solo valida el entorno.

set -euo pipefail

echo "==> study-tracker :: init"

# --- 1. Entorno ---------------------------------------------------------------
echo "--> Verificando herramientas"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node no esta instalado." >&2
  exit 1
fi

NODE_MAJOR="$(node --version | sed 's/^v\([0-9]*\).*/\1/')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "ERROR: se requiere Node 20 o superior. Encontrado: $(node --version)" >&2
  exit 1
fi
echo "    node $(node --version)"
echo "    npm  $(npm --version)"

# --- 2. Variables de entorno --------------------------------------------------
echo "--> Verificando variables de entorno"

if [ ! -f .env ]; then
  echo "    AVISO: no existe .env. Copialo de .env.example y completa DATABASE_URL."
  echo "    R0 no puede completarse sin una base de datos."
else
  if grep -q '^DATABASE_URL=.\+' .env; then
    echo "    DATABASE_URL presente"
  else
    echo "    AVISO: .env existe pero DATABASE_URL esta vacio."
  fi
fi

# --- 3. Dependencias ----------------------------------------------------------
if [ ! -f package.json ]; then
  echo "--> Sin package.json todavia: el proyecto esta en estado semilla."
  echo ""
  echo "Init OK (semilla)."
  echo "Siguiente paso: implementar R0. Lee docs/ROADMAP.md seccion R0."
  exit 0
fi

echo "--> Instalando dependencias"
npm install

# --- 4. Verificacion ----------------------------------------------------------
# NO usar `npm run <x> --if-present`: si el script no existe, npm termina en 0 sin
# imprimir nada, y la AUSENCIA de verificacion se ve identica a una verificacion
# que pasa. Durante toda la rebanada R0 las pruebas "pasaron" porque no existian.
# Aqui cada script requerido se exige de forma explicita.

require_script() {
  local nombre="$1"
  if ! node -e "process.exit(require('./package.json').scripts?.['$nombre'] ? 0 : 1)"; then
    echo "" >&2
    echo "ERROR: falta el script '$nombre' en package.json." >&2
    echo "AGENTS.md lo declara comando de verificacion obligatorio." >&2
    echo "Agregalo, o corrige AGENTS.md si de verdad ya no aplica." >&2
    exit 1
  fi
  echo "--> $nombre"
  npm run "$nombre"
}

require_script check
require_script lint
require_script test
require_script build

echo ""
echo "Init OK."
echo "Levanta el servidor con: npm run dev"
