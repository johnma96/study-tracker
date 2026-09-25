# notas-r4.md — Agente B, rebanada R4 (Evidencia enlazada)

Worktree `study-tracker-r4`, rama `r4-evidencia`, base `418c60c`. Branch de Neon `dev-r4`.

| | |
|---|---|
| Inicio | 25/09/2026 10:52:00 (-05:00) |
| Fin | 25/09/2026 11:12 (-05:00) aprox., tras el commit de cierre |
| Duración | unos 20 minutos de trabajo del agente |
| Estado final | **R4 en `passing`** con `evidence` y `testedAt` |

## Qué se hizo

- **Dominio (`src/core/`)**
  - `model/artifact.ts`: `ARTIFACT_KINDS` (RF-51) como constante de dominio, `Artifact` y `NewArtifactInput`.
  - `services/artifact-target.ts`: la única definición de destino válido. `validateArtifactTarget` (al guardar),
    `safeExternalHref` (al presentar) y `thumbnailSrc` (RF-53).
  - `services/artifact-input.ts`: esquema `zod` de la Server Action (`parseNewArtifact`). Sigue el patrón de
    `program-input.ts` y `session-input.ts`.
  - `services/artifact-grouping.ts`: `groupArtifactsBySession`, para colgar la evidencia de cualquier listado sin
    consultar una vez por fila.
  - `ports/artifact-repository.ts`: `attach`, `listBySession`, `listBySessionIds` y `listRecentEvidence`.
  - `no-file-storage.test.ts`: la prueba de RF-54 (diseño más abajo).
- **Infraestructura**: bloque `// R4 — artifacts` al final de `schema.ts`, migración `0001_artifacts.sql` y
  `drizzle-artifact-repository.ts`.
- **App**: `artifact-actions.ts` (`attachArtifactAction`) y `evidence.ts` (el cargador, con el mismo reparto que
  `current-session.ts`).
- **UI** (componentes propios): `artifact-form.tsx`, `artifact-list.tsx`, `artifact-thumbnail.tsx`,
  `artifact-labels.ts`, `session-artifacts.tsx` y `session-evidence.tsx`.
- **Integración**: `tests/integration/artifacts.integration.test.ts`.

## Decisiones

1. **Solo `http`/`https`, con lista blanca y no lista negra.** Todo destino que empiece por un esquema tiene que ser
   `http://` o `https://`, con host y sin credenciales. Se analiza con `URL` (el mismo analizador del navegador) y se
   guarda la forma normalizada, de modo que lo guardado es exactamente lo que se presenta. Además se rechazan los
   caracteres de control, porque el navegador los elimina y `java\tscript:` llegaría como `javascript:`.
2. **La lista blanca se aplica dos veces.** Una al guardar y otra al presentar (`safeExternalHref`). Así una fila
   escrita saltándose la Server Action no se convierte en enlace ejecutable. El humo lo comprobó con una fila
   `javascript:alert(1)` insertada directamente: se pintó como texto.
3. **Ruta relativa de repositorio.** Se rechazan la barra inicial (incluido `//host`, que es relativo al protocolo),
   `~`, la unidad de Windows (`C:\`) y los segmentos `..`. Las `\` pasan a `/` y se quita el `./`. **Una ruta se
   muestra como texto, no como enlace**: no hay una URL base contra la que resolverla (ver contradicción 3).
4. **RF-53 sin comprobación en el servidor.** Si el servidor pidiera la URL para saber si es "accesible", abriría la
   puerta a SSRF. La miniatura es un `<img>` de cliente con `loading="lazy"`, `referrerPolicy="no-referrer"` y
   `onError`, que la oculta y deja el enlace. Se usa `<img>` y no `next/image`, porque este exige declarar los
   dominios en `next.config.ts`.
5. **Enlaces externos** con `target="_blank"` (RF-52) y `rel="noopener noreferrer"`, y texto `sr-only` "(abre en
   una pestaña nueva)".
6. **CHECK añadidos al DDL**: `artifacts_label_not_empty` y `artifacts_target_not_empty` (`char_length >= 1`). El
   motivo es que `NOT NULL` deja pasar `''` y RF-50 los hace obligatorios. **No** se llevaron al motor los topes de
   120 y 2048, que son criterio de interfaz (decisión 17). También se añadió el índice
   `artifacts_by_session (session_id, created_at)`, porque Postgres no indexa por sí solo la columna de una FK.
7. **Detectar que la sesión no existe sin interpretar el código de error.** Si falla la inserción, `attach` vuelve a
   consultar si la sesión existe: si no existe, devuelve `session_not_found`; si existe, propaga el error. Así no hizo
   falta tocar `unique-violation.ts` (compartido) para detectar el código 23503.
8. **Migración con nombre**: se generó con `npm run db:generate -- --name artifacts`, para que la integración se lea
   sin adivinar (la primera salió como `0001_famous_komodo` y se regeneró).
9. **La sección "Evidencia de las sesiones recientes"** (`SessionEvidence` + `listRecentEvidence`, 10 sesiones,
   cerradas o en curso) se construyó **antes** del aviso de que R3 ya trae un listado. Se deja tal cual. Después del
   aviso se separó el componente autocontenido `SessionArtifacts({ sessionId, artifacts })` y el método en bloque
   `listBySessionIds`, para que quien integra lo enganche al listado de R3.
10. **Sin dependencias nuevas** y sin `npx shadcn add`. Se usaron `Badge`, `Button`, `Card`, `Input`, `Label` y
    `Select` de `src/ui/primitives/`.

### Diseño de la prueba de RF-54 (`src/core/no-file-storage.test.ts`)

RF-54 es un requerimiento negativo: no hay función que ejercitar, hay algo que no debe existir. La prueba **lee el
código**: recorre `src/`, `scripts/` y los archivos sueltos de la raíz (86 archivos hoy) y falla si encuentra
cualquiera de las tres puertas por las que un archivo podría quedar guardado.

1. **Disco.** Las API de escritura de Node (`writeFile`, `appendFile`, `createWriteStream`, `copyFile`, `cp`,
   `writev`). Además, en `src/` está prohibido **importar** `fs`: es más robusto que enumerar funciones, porque no
   deja escapar `fs.promises.open(…, 'w')`.
2. **Subida.** Un `type="file"`, o `instanceof File/Blob` o `.arrayBuffer(` en `src/`.
3. **Almacenamiento en otra parte.** `bytea` en el esquema o en las migraciones, o dependencias de subida o de
   almacenamiento en `package.json` (`@vercel/blob`, `multer`, S3…).

La única exclusión es el propio archivo de la prueba. No hay lista de permitidos: si una rebanada necesitara escribir
un archivo, tendría que editar la prueba, y ese cambio se vería en la revisión. Para no pasar en vacío, la prueba
exige más de 30 archivos, entre ellos `schema.ts`, `artifact-actions.ts` y alguna migración, y comprueba que su
detector marca siete ejemplos prohibidos. Por qué vive en `src/core/`: `vitest.config.mts` solo recoge
`src/core/**`, y la prueba no importa `app/`, `infra/` ni `ui/`; solo lee texto.

## Evidencia (todo el 25/09/2026)

| Comando | Resultado |
|---|---|
| `npm run check` | OK, 0 errores |
| `npm run lint` | OK, 0 problemas |
| `npm run test` | 13 archivos, **188 pruebas**, todas pasan (118 de R1/R2 + 70 de R4) |
| `npm run test:integration` | 2 archivos, **15 pruebas**, todas pasan (8 de R2 + 7 de R4), contra `dev-r4` |
| `npm run db:generate -- --name artifacts` | `0001_artifacts.sql` + `meta/0001_snapshot.json` + entrada en `_journal.json` |
| `npm run db:check` | `Everything's fine` |
| `npm run db:migrate` | `migrations applied successfully!` contra `dev-r4` (host distinto al de `main`, comparado sin imprimir la cadena) |
| `npm run build` | OK |
| `./init.sh` | `Init OK`, código de salida 0 |
| Humo `npx next dev -p 3004` + `curl` | HTTP 200. Ver detalle abajo |

**SQL generado, revisado antes de subirlo:** `CREATE TABLE "artifacts"` con los tres CHECK con nombre, la FK
`artifacts_session_id_sessions_id_fk ... ON DELETE cascade` y `CREATE INDEX "artifacts_by_session"`. No toca
`sessions` ni `one_running_session`.

**Pruebas de reversión** (comprobadas de verdad y restauradas desde copia):

| # | Reversión | Resultado |
|---|---|---|
| 1a | La lista blanca se cambia por una lista negra que solo bloquea `javascript:` | Fallan **7**: `data:`, `vbscript:`, `file:`, `ftp:`, `mailto:`, `https:` sin `//` y `data:image/svg` al presentar |
| 1b | Al presentar, el `href` se toma del destino tal cual | Fallan **5**: `javascript:`, con espacios, `data:`, credenciales y el `src` de la miniatura |
| 2 | Se agrega `video` a `ARTIFACT_KINDS` | Fallan **2** de RF-51 |
| 3 | Se agrega un `writeFile` con import de `node:fs/promises` a `artifact-actions.ts` | Falla la de RF-54, señalando las dos líneas |

**Humo.** Con una sesión y cuatro artefactos en la base, incluida una fila hostil `javascript:alert(1)` escrita
directamente, el HTML traía:

- 3 enlaces con `target="_blank" rel="noopener noreferrer"`;
- el `<img>` de la miniatura, con `referrerPolicy="no-referrer"`;
- la ruta relativa como texto;
- la fila hostil solo como texto;
- **cero** `href` o `src` con `javascript:`;
- ningún `type="file"`.

La Server Action se ejercitó por `curl` con el envío sin JavaScript del formulario (los campos `$ACTION_*` que trae
el HTML):

- `javascript:` → rechazado con el motivo del campo `target`;
- `kind=video` → motivo en `kind`;
- `C:\Users\…` → "no una ruta de tu disco";
- un envío sin `sessionId` → "Sesión no válida";
- una URL de GitHub válida → "Evidencia … adjuntada", y en el GET siguiente aparece como enlace.

Al terminar se borraron los datos de humo y se detuvo el servidor. **Estado final de `dev-r4`:** 1 programa, 4 tipos,
0 sesiones, 0 artefactos, 2 migraciones registradas.

**Confirmación humana pendiente (no bloquea):** abrir en el navegador un artefacto `doc` con una URL de GitHub y
comprobar que abre el archivo real en una pestaña nueva.

## Contradicciones en la documentación (no se editaron: las corrige quien integra)

1. **`AGENTS.md` / `docs/ARCHITECTURE.md`** dicen que "`core/` no importa nada de `app/`, `infra/` ni `ui/`" y que
   "es la única regla de capas que se verifica automáticamente". **No hay nada que la verifique**: ni una regla de
   `eslint.config.mjs` ni una prueba. Se puede cubrir con una prueba del mismo estilo que `no-file-storage.test.ts`,
   pero eso queda fuera de R4.
2. **`docs/DATA-MODEL.md`**:
   - dice que `artifacts` "sigue siendo solo especificación", y ya está aplicada;
   - su DDL no tiene `artifacts_label_not_empty`, `artifacts_target_not_empty` ni el índice `artifacts_by_session`;
   - el invariante 6 no menciona que la cascada de `sessions` también se lleva los artefactos.
3. **RF-50 frente a RF-52.** RF-50 admite como destino una "ruta relativa de repositorio", y RF-52 pide mostrar
   **todos** los artefactos "como enlaces que abren en una pestaña nueva". Una ruta relativa no tiene base: ni
   `programs` ni `sessions` guardan la URL del repositorio, y un `href` relativo apuntaría a la propia aplicación. Se
   implementó como texto. Resolverlo requiere una decisión de producto, por ejemplo una columna `repo_url` en
   `programs`.
4. **`feature_list.json`, entrada R4, campo `verification`:** `npm run test -- artifacts` **no encuentra ningún
   archivo** ("No test files found"), porque el filtro busca "artifacts" en plural y los archivos son
   `artifact-*.test.ts`. `npm run test -- artifact` sí funciona (3 archivos, 66 pruebas), pero no incluye la prueba
   de RF-54. No se cambió el campo porque las reglas del abanico solo autorizan `status`, `evidence` y `testedAt`.

## Hallazgos fuera de alcance

- **Un artefacto no se puede editar ni borrar.** RF-50 no lo pide, pero un URL mal pegado se queda para siempre.
  Genera fricción.
- **React 19 vacía los campos del formulario tras cada envío**, también cuando el servidor lo rechaza. Pasa en todos
  los formularios del repositorio, no solo en este.
- **Empate de orden.** Dos artefactos insertados en la misma transacción comparten `created_at`, y el desempate por
  `id` es estable pero arbitrario. Por la interfaz no ocurre, porque cada envío es una transacción.
- **El encabezado de la página sigue diciendo `study-tracker · R2`.** No se cambió para no chocar con R3 y R5.
- **Operativo (Windows):** detener la tarea de `npx next dev` no mata el proceso hijo `start-server.js`, que se
  queda escuchando en el puerto. Hubo que detenerlo por PID, tras comprobar que su línea de comandos era la del
  worktree r4.
- `drizzle-kit migrate` avisa de que `@neondatabase/serverless` usa websocket. Es inocuo y ya ocurría antes.

## Archivos compartidos tocados

| Archivo | Cambio |
|---|---|
| `src/app/page.tsx` | +11 líneas: 2 imports (`loadRecentEvidence`, `SessionEvidence`), `const evidence = await loadRecentEvidence();` después de `loadSessionSnapshot()`, y `<SessionEvidence …/>` entre "Registrar una sesión a mano" y "Nuevo programa" |
| `src/infra/db/schema.ts` | Solo se añadió un bloque al final, delimitado por `// R4 — artifacts`. No se modificó nada anterior |
| `src/infra/db/migrations/meta/_journal.json` | Entrada `idx: 1`, `tag: 0001_artifacts` |
| `src/infra/db/migrations/meta/0001_snapshot.json` | Nuevo |
| `src/infra/db/migrations/0001_artifacts.sql` | Nuevo |
| `feature_list.json` | Solo la entrada R4 (`status`, `evidence`, `testedAt`). `lastUpdated` no se tocó |
| `package.json`, `components.json`, `layout.tsx`, `globals.css`, `src/ui/primitives/*` | **Sin cambios** |
| `drizzle-session-repository.ts`, `unique-violation.ts`, `labels.ts` | **Sin cambios**. No hizo falta exportar `toDomain` |

## Guía para integrar

- **Migraciones:** R5 debe borrar su `0001_*` y regenerar para que salga `0002_*`. Luego, contra `dev`:
  `npm run db:check`, `npm run db:migrate`, `npm run test` y `npm run test:integration`.
- **Enganchar al listado de R3:** con los ids de las sesiones listadas,
  `groupArtifactsBySession(await drizzleArtifactRepository.listBySessionIds(ids))`, y en cada fila
  `<SessionArtifacts sessionId={s.id} artifacts={grouped.get(s.id) ?? []} />`. Si con eso sobra la sección propia,
  se pueden retirar `SessionEvidence`, `app/evidence.ts`, `listRecentEvidence` y `EvidenceSession`. En ese caso hay
  que ajustar la prueba de integración, que usa `listRecentEvidence`.
- **Riesgo para R3 y R5:** `no-file-storage.test.ts` recorre **todo** `src/`. Si R5 u otra rama usa `.arrayBuffer(`,
  `instanceof Blob` o importa `fs` en `src/`, la prueba fallará al integrar. Es intencional: la corrección es
  revisar ese código, no ampliar la exclusión sin motivo. La prueba también exige que exista
  `src/app/artifact-actions.ts`: si se renombra, hay que actualizarla.
- **Pruebas de integración:** las de R4 usan solo sesiones cerradas, así que no chocan con `one_running_session` ni
  con la suite de R2.
