# ARCHITECTURE.md — decisiones tomadas

Las decisiones de este documento **ya están tomadas**. Un agente que implemente no debe
re-litigarlas. Si una resulta equivocada durante el desarrollo, se registra el hallazgo en
`progress.md` y se consulta antes de cambiarla.

## Stack

| Capa | Elección | Motivo |
|---|---|---|
| Framework | **Next.js 16, App Router** | Despliegue nativo en Vercel. Server Actions eliminan la capa de API en el MVP. El Pages Router está en mantenimiento: no usarlo. |
| Lenguaje | **TypeScript**, modo estricto | |
| UI | **React 19** + **Tailwind** + **shadcn/ui** | Componentes accesibles sin trabajo de diseño. |
| Gráficas | **Recharts** | El mapa de calor de calendario se hace con SVG propio; no requiere librería. |
| ORM | **Drizzle** | Esquema en TypeScript, sin binarios nativos, compatible con entornos edge. Migraciones con `drizzle-kit`. |
| Base de datos | **Postgres (Neon)** | Es la integración nativa de Vercel desde que Vercel Postgres se migró a Neon (dic 2024). Tiene *branching* para separar entornos. |
| Pruebas | **Vitest** | |
| Autenticación | **Auth.js**, diferido a la rebanada 6 | Ver `RF-40`. |

**No fijes versiones a mano.** Instala con `@latest` y deja que `package.json` registre lo que
quedó. Verificado al 24/09/2026: Next.js 16.3.6 es LTS activo. Las versiones de las demás
dependencias no fueron verificadas en esa fecha: confírmalas al instalar.

## Postgres en todos los entornos

Decisión explícita: **no** usar archivos JSON ni SQLite en desarrollo.

La secuencia intuitiva (JSON local → SQLite → Postgres en producción) obliga a reescribir la
capa de datos dos veces e introduce defectos que solo aparecen en producción. Con Postgres en
todos lados no hay migración de motor en ningún momento.

- **Desarrollo:** un *branch* de Neon llamado `dev`, o Postgres local con Docker Compose.
- **Producción:** Neon vía la integración de Vercel.

Misma sintaxis SQL, mismas migraciones, cero conversión de datos.

## Capas

```
app/            Next.js App Router. Páginas y Server Actions. Sin lógica de negocio.
  └ (rutas)
core/           Dominio puro. Sin imports de React, Next, Drizzle ni de la base de datos.
  ├ model/      Tipos y entidades
  ├ services/   Reglas: duración efectiva, racha, cadencia, proyección
  └ ports/      Interfaces de repositorio
infra/
  ├ db/         Esquema Drizzle, cliente, migraciones
  └ repos/      Implementaciones de los puertos de core/ports
ui/             Componentes de presentación, sin acceso a datos
```

**La regla que importa:** `core/` no importa nada de `app/`, `infra/` ni `ui/`. Es la única
regla de capas que se verifica automáticamente.

Justificación honesta: el valor de esta separación **no** es sobrevivir a un cambio de base de
datos — esa migración ya la eliminamos. Es poder probar la lógica de cálculo (duración
efectiva con `minutes_override`, racha con cambio de día en `America/Bogota`, proyección de
fecha) **sin levantar una base de datos**. Esa lógica es donde viven los errores reales.

No se implementa CQRS. En una aplicación de un usuario sería ceremonia sin beneficio.

## Flujo de datos

Lectura: Server Component → repositorio → Drizzle → Postgres.
Escritura: formulario → Server Action → validación → servicio de dominio → repositorio.

Toda Server Action valida su entrada en el servidor con un esquema (`zod` o equivalente).
`RF-44` es obligatorio: la validación del cliente es conveniencia, no control.

## Seguridad

- Secretos solo en variables de entorno. `.env` nunca se versiona. `.env.example` documenta
  cada variable con valores falsos.
- La cadena de conexión nunca llega al cliente. No usar el prefijo `NEXT_PUBLIC_` para nada
  sensible.
- Escapar o parametrizar toda consulta. Drizzle lo hace por defecto: no construyas SQL por
  concatenación de cadenas.
- `RF-40` es una compuerta de despliegue: sin autenticación, no se publica con datos reales.

## Comandos de arranque para la rebanada 0

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit vitest
npx shadcn@latest init
```

Variables de entorno necesarias (documéntalas en `.env.example`):

```
DATABASE_URL=postgres://usuario:clave@host/base?sslmode=require
APP_TIMEZONE=America/Bogota
```

> **No uses el nombre `TZ`.** Vercel lo tiene reservado: es una variable de sistema que fija la
> zona horaria del runtime de Node, y el despliegue se rechaza con
> *"The name of your Environment Variable is reserved"*. Comprobado el 25/09/2026.
>
> La razón de fondo va más allá del nombre. `RF-00` fija `America/Bogota` como **regla de
> dominio**, no como configuración: no cambia entre entornos. Una constante que no varía por
> entorno no debería ser variable de entorno, porque si falta o se escribe mal en producción,
> la agrupación por día se rompe **en silencio**. El lugar correcto es una constante en
> `core/`. `APP_TIMEZONE` queda documentada por si algún día la zona se vuelve preferencia del
> usuario, en cuyo caso pertenece a la base de datos, no al entorno.

## Registro de decisiones

| # | Decisión | Fecha | Motivo |
|---|---|---|---|
| 1 | Next.js App Router, no Pages Router | 24/09/2026 | Pages Router en mantenimiento |
| 2 | Postgres en todos los entornos | 24/09/2026 | Evita dos migraciones de motor |
| 3 | Drizzle sobre Prisma | 24/09/2026 | Sin binarios, más cerca del SQL, mejor para aprender |
| 4 | Sin subida de archivos en el MVP | 24/09/2026 | La evidencia vive en sus repos; aquí se enlaza |
| 5 | Sin CQRS | 24/09/2026 | Ceremonia sin beneficio para un usuario |
| 6 | Autenticación como compuerta, no como etapa | 24/09/2026 | Vercel publica en internet abierto |
