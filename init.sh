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

script_existe() {
  local nombre="$1"
  if ! node -e "process.exit(require('./package.json').scripts?.['$nombre'] ? 0 : 1)"; then
    echo "" >&2
    echo "ERROR: falta el script '$nombre' en package.json." >&2
    echo "AGENTS.md lo declara comando de verificacion obligatorio." >&2
    echo "Agregalo, o corrige AGENTS.md si de verdad ya no aplica." >&2
    exit 1
  fi
}

require_script() {
  local nombre="$1"
  script_existe "$nombre"
  echo "--> $nombre"
  npm run "$nombre"
}

# Solo se comprueba que exista: no se ejecuta aqui.
# `test:integration`, `db:migrate` y `db:seed` necesitan red y DATABASE_URL, y esta
# puerta de entrada no puede depender de que Neon responda: un branch caducado se
# leeria como codigo roto. `vercel-build` tampoco se ejecuta aqui, porque aplicaria
# migraciones en cada corrida de init.sh.
# Pero si cualquiera de esos scripts desapareciera del package.json, la evidencia
# dejaria de ser reproducible --o, peor, el despliegue dejaria de aplicar el
# esquema-- sin que nada avisara, que es el mismo defecto del `--if-present` con
# otra cara.
declare_script() {
  local nombre="$1"
  local nota="${2:-se ejecuta a mano: requiere base de datos}"
  script_existe "$nombre"
  echo "    $nombre declarado ($nota)"
}

require_script check
require_script lint
require_script test
# `db:check` valida el historial de migraciones (journal y snapshots coherentes,
# sin colisiones de indice). No abre conexion ni necesita DATABASE_URL, asi que si
# cabe dentro de la puerta de entrada.
require_script db:check
declare_script test:integration
declare_script db:generate "genera la migracion despues de tocar src/infra/db/schema.ts"
declare_script db:migrate
declare_script vercel-build "lo ejecuta Vercel: aplica migraciones y luego construye"
require_script build

echo ""
echo "Init OK."
echo "Esquema de la base:     npm run db:migrate   (idempotente; no toca datos)"
echo "Datos semilla:          npm run db:seed      (idempotente)"
echo "Pruebas contra la base: npm run test:integration"
echo "Levanta el servidor con: npm run dev"
