# notas-r5.md — Agente C, rebanada R5 (Métricas de progreso)

Notas para quien integra. No sustituyen a `progress.md` ni a `session-handoff.md`: se
consolidan allí.

## Tiempos

| Marca | Valor |
|---|---|
| Inicio | 25/09/2026 10:52:19 (`date` al arrancar) |
| Fin | 25/09/2026 11:08 aprox. (`date` antes de las notas: 11:07:28) |
| Duración | unos 16 minutos de reloj, con lectura del harness, `./init.sh` y la verificación completa |

## Estado final

R5 queda en `passing`, con `evidence` y `testedAt: "2026-09-25"`. En `feature_list.json` solo
se tocó la entrada R5 (`status`, `verification`, `evidence`, `testedAt`). `lastUpdated` y las
demás entradas quedaron intactas.

## Qué se hizo

- **Esquema** (commit `aa8010f`, solo migración): `metrics` y `readings` al final de
  `src/infra/db/schema.ts`, en el bloque `// R5 — metrics y readings`. Migración generada:
  `src/infra/db/migrations/0001_nosy_patch.sql`, más `meta/0001_snapshot.json` y la entrada
  en `meta/_journal.json`. Aplicada con `npm run db:migrate` contra `dev-r5`.
- **Dominio** (`src/core/`): `model/metric.ts`, `ports/metric-repository.ts`,
  `services/metric-trend.ts` (orden de la serie y veredicto de RF-63),
  `services/metric-input.ts` (validación `zod` de RF-60, RF-61 y RF-44) y
  `services/reading-session.ts` (la sesión asociada debe ser del programa de la métrica).
- **Infraestructura**: `src/infra/repos/drizzle-metric-repository.ts`.
- **App**: `src/app/metric-actions.ts` (Server Actions) y `src/app/metrics-snapshot.ts`
  (carga de datos para la página).
- **Interfaz**: `src/ui/metrics-section.tsx`, `metric-card.tsx`, `metric-chart.tsx`,
  `metric-form.tsx`, `reading-form.tsx` y `metric-view.ts`. `page.tsx` solo importa y monta
  `<MetricsSection>`.
- **Semilla**: `scripts/seed.mjs` siembra la métrica "Harness score" (puntos, `up`, objetivo
  80), como asigna a R5 la sección de datos semilla de `docs/DATA-MODEL.md`. Es idempotente.
- **Pruebas**: `metric-trend.test.ts` y `metric-input.test.ts` (43 pruebas nuevas en
  `npm run test`) y `tests/integration/metrics.integration.test.ts` (5 pruebas nuevas).

## Decisiones

1. **`readings.created_at` agregado, aunque no está en el DDL.** RF-63 compara "la última" con
   "la anterior". Con solo `recorded_at`, dos lecturas del mismo minuto no tienen orden
   definido y el veredicto dependería del plan de consulta. `created_at` las desempata (la
   registrada después es la última) y `id` deja el orden total.
2. **CHECK de longitud en `metrics`**: `name` entre 1 y 80 y `unit` nula o entre 1 y 24. Es el
   mismo criterio que usó R1 en `session_types`, y los valores coinciden con
   `core/services/metric-input.ts`.
3. **Índice `readings_by_metric_time (metric_id, recorded_at)`**, para la única consulta de la
   serie.
4. **`numeric` en modo `number`** en Drizzle. Por defecto vuelve como cadena, y RF-63
   compararía texto (`'9' > '10'`). La entrada se limita a 9 cifras enteras y 6 decimales
   para que el `number` de JavaScript conserve exactamente lo que el usuario escribió.
5. **Se acepta la coma decimal** (`80,5`), porque es la convención colombiana. No se aceptan
   separadores de miles ni notación científica.
6. **El orden y el veredicto viven en `core/`**, no en un `ORDER BY` ni en el componente
   (mismo criterio que la decisión 12). El repositorio devuelve las lecturas ya pasadas por
   `sortReadings`.
7. **El empate se decide comparando valores**, no por el signo de la resta.
8. **La sesión asociada debe ser del programa de la métrica.** La FK no lo impide. La regla está
   en `core/services/reading-session.ts` y la aplica la Server Action.
9. **El formulario de lecturas ofrece las 5 sesiones más recientes del programa** y propone la
   que esté en curso. La consulta (`listLinkableSessions`) quedó en el repositorio de métricas
   para no ensanchar `SessionRepository`, que R3 probablemente también toca.
10. **Gráfica**: eje X temporal (`type="number"`, `scale="time"`), para que la pendiente no
    mienta sobre la velocidad de avance. Una sola serie sin leyenda. Objetivo punteado con
    etiqueta y `ifOverflow="extendDomain"`, para que se vea aunque quede fuera del rango de las
    lecturas. Colores por variables CSS (`var(--foreground)`, `var(--muted-foreground)`,
    `var(--background)`), sin `theme`. Debajo va una tabla de lecturas plegable, como vista
    accesible.
11. Las etiquetas de R5 quedaron en sus propios componentes y no en `src/ui/labels.ts`, para no
    chocar con R4.

No se agregaron dependencias ni primitivas de shadcn.

## Evidencia (resumen; el detalle está en `feature_list.json`)

| Comando | Resultado |
|---|---|
| `npm run test` | 11 archivos, 161 pruebas, todas pasan |
| `npm run test:integration` | 2 archivos, 13 pruebas, todas pasan (contra `dev-r5`) |
| `npm run check` | OK |
| `npm run lint` | OK |
| `npm run build` | OK |
| `./init.sh` | `Init OK` |
| `npm run db:check` | `Everything's fine` |
| `npm run db:migrate` | aplicada; la segunda corrida no hace nada |
| `npm run db:seed` ×2 | inserta la métrica; la segunda vez dice "ya presente" |
| Reversión RF-63 (ignorar dirección) | 3 pruebas fallan; restaurado, 161 pasan |
| Reversión RF-63 (quitar empate) | 3 pruebas fallan; restaurado, 161 pasan |
| Humo `curl` en :3005 | HTTP 200. Sección, veredicto "Mejoró +15 puntos", fechas en hora de Colombia y serie en orden |
| Server Actions por POST multipart sin JS | 6 envíos hostiles rechazados con su mensaje y sin crear filas; 1 válido (`80,5`) registrado |
| Captura con Edge headless | la gráfica dibuja la serie y el objetivo en 80 |

La base `dev-r5` quedó con 1 programa, 4 tipos, 0 sesiones, 1 métrica (la semilla) y 0
lecturas. El servidor de :3005 se detuvo y el `next dev` del usuario en :3000 no se tocó.

## Contradicciones en la documentación (no se editaron; las corrige quien integra)

1. **`docs/DATA-MODEL.md`, DDL de `metrics` y `readings`**: falta `readings.created_at`, los
   CHECK `metrics_direction_valid`, `metrics_name_length` y `metrics_unit_length`, y el índice
   `readings_by_metric_time`. El esquema real ya los tiene (decisiones 1 a 3).
2. **`docs/DATA-MODEL.md`, "Estado al 25/09/2026"** dice que `metrics` y `readings` son solo
   especificación. Tras integrar R5 quedan aplicadas.
3. **`docs/DATA-MODEL.md`, nota "Reparto por rebanada"**: sigue siendo cierta, pero ahora la
   siembra existe. Conviene decirlo.
4. **`feature_list.json`, `verification` de R5** decía `npm run test -- metrics`. Ese filtro
   **no selecciona ningún archivo** (`No test files found, exiting with code 1`), porque los
   archivos se llaman `metric-trend` y `metric-input`. Lo corregí en la propia entrada R5,
   que sí es mía.
5. **`src/ui/primitives/chart.tsx`** resuelve el tema oscuro con el selector `.dark`, que nunca
   se activa: la decisión 24 lo lleva por `prefers-color-scheme`. `theme.dark` en
   `ChartConfig` no tiene efecto. R5 no se ve afectado porque usa variables CSS. No se editó
   `chart.tsx` (aviso de quien integra).
6. `docs/ARCHITECTURE.md` debería registrar las decisiones 1, 4 y 5 de estas notas.

## Hallazgos fuera de alcance

- **No se pueden corregir ni borrar métricas ni lecturas desde la interfaz.** RF-60 a RF-63 no
  lo piden, pero una lectura mal tecleada queda en la serie y en el veredicto de RF-63. Es
  fricción real de producto; valdría una rebanada pequeña.
- `listLinkableSessions` lee `sessions` desde el repositorio de métricas. Si R3 agrega un
  listado de sesiones por programa, se puede consolidar al integrar.
- La captura con Edge headless sin `--virtual-time-budget` sale con la gráfica vacía, porque
  se toma antes de hidratar. No es un defecto; hay que tenerlo en cuenta si alguien usa esa
  técnica como evidencia.

## Archivos compartidos tocados

| Archivo | Cambio | Riesgo al integrar |
|---|---|---|
| `src/infra/db/schema.ts` | import `numeric` y bloque final `// R5 — metrics y readings` | Bajo: R4 agrega `artifacts` también al final. La fusión es mecánica, pero **ojo con el import**: R4 no necesita `numeric`, y los dos pueden tocar la lista de imports |
| `src/infra/db/migrations/0001_nosy_patch.sql`, `meta/0001_snapshot.json`, `meta/_journal.json` | Migración de R5 | **Alto**: choca con el `0001_*` de R4. Al integrar hay que borrar el `.sql`, el snapshot `0001_snapshot.json` y la entrada `idx: 1` del journal de R5, fusionar R4 y correr `npm run db:generate`, que dará `0002_*`. Luego `npm run db:check` y `npm run db:migrate` contra `dev`. El `.sql` regenerado debe traer lo mismo que `0001_nosy_patch.sql` |
| `src/app/page.tsx` | 3 imports, `Promise.all` con `loadMetricsSnapshot()` y el bloque `<MetricsSection>` al final del fragmento | Medio: R3 y R4 también montan secciones ahí |
| `scripts/seed.mjs` | comentario de cabecera y bloque final `// --- R5 — metrics` | Bajo |
| `feature_list.json` | solo la entrada R5 | Mecánico |
| `package.json` | **no se tocó** | — |

`dev-r5` tiene registrada en `drizzle.__drizzle_migrations` la migración con el hash de
`0001_nosy_patch`. Ese branch es desechable. En `dev`, la migración regenerada se aplica
limpia.

Para comparar hosts leí **solo el host** de `DATABASE_URL` de `../study-tracker/.env` (sin
modificar nada ni imprimir la cadena): el de `dev-r5` es distinto.
