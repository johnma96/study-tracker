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
echo "--> Verificando tipos"
npm run check --if-present

echo "--> Lint"
npm run lint --if-present

echo "--> Pruebas"
npm run test --if-present

echo "--> Build"
npm run build --if-present

echo ""
echo "Init OK."
echo "Levanta el servidor con: npm run dev"
