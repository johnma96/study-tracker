# CLAUDE.md — study-tracker

@AGENTS.md

Las reglas operativas —flujo de arranque, comandos de verificación, definición de *done*,
alcance y cierre de sesión— viven en [`AGENTS.md`](./AGENTS.md). Este archivo explica **qué es
este repositorio y por qué existe**.

## Objetivo del repositorio

`study-tracker` registra sesiones de estudio de **varios programas de aprendizaje** —cursos,
certificaciones, diplomados, bootcamps, autoestudio— y responde siempre tres preguntas:

1. ¿Qué días trabajé y cuánto tiempo?
2. ¿Qué produjo cada sesión? (evidencia enlazable)
3. ¿Cómo avanza el progreso de cada programa?

## La decisión de diseño que lo define todo

**Cada programa mide el progreso de forma distinta.** El curso de harness engineering usa un
score de 0 a 100; una certificación de plataforma usa módulos completados; un diplomado usa
notas por corte; un curso de programación usa ejercicios que pasan sus pruebas.

Por eso el progreso **no** se modela como un porcentaje único. Cada programa define sus
propias métricas y el sistema grafica cualquier serie sin saber qué significa.

Consecuencia directa para quien implemente: **no acoples nada al primer programa.** Si una
decisión solo tiene sentido para el curso de harness engineering, está mal. Los tipos de
sesión, las métricas y las unidades son datos, no enumeraciones en el código.

## Los dos propósitos de este repositorio

**Producto.** Una herramienta que uso de verdad. Si al cabo de un mes tengo que completar
datos a mano el domingo porque olvidé usarla, falló — y la causa será fricción en el registro,
no falta de features.

**Campo de práctica.** Este repositorio es donde se aplica, sobre código real, lo que enseña
el curso de harness engineering (`../learn-harness-engineering`). Por eso `AGENTS.md`,
`feature_list.json`, `init.sh`, `progress.md` y `session-handoff.md` no son decoración: son el
objeto de estudio. El score de `validate-harness.mjs` sobre este repositorio es la medida de
adopción de la metodología.

Cuando los dos propósitos entren en conflicto, gana el producto: un harness excelente sobre
una herramienta que nadie usa no enseña nada.

## Dónde vive el estado

**Este archivo no describe el estado del repositorio, a propósito.**

| Pregunta | Archivo que la responde |
|---|---|
| ¿Qué está hecho y con qué evidencia? | [`feature_list.json`](./feature_list.json) |
| ¿Dónde quedó la sesión anterior y qué sigue? | [`session-handoff.md`](./session-handoff.md) |
| ¿Qué pasó en cada sesión y por qué? | [`progress.md`](./progress.md) |
| ¿Cuál es el plan completo? | [`docs/ROADMAP.md`](./docs/ROADMAP.md) |

> Antes este archivo declaraba el estado del proyecto, y quedó desactualizado: siguió diciendo
> "semilla, sin código todavía" cuando ya había dos rebanadas cerradas. El flujo de arranque lo
> hace leer en el paso 2, así que cada agente recibía un estado falso mientras armaba su modelo
> mental del repositorio.
>
> La causa no fue descuido: fue poner **estado mutable en un documento que cambia poco**. La
> regla que queda es que cada dato tenga un solo dueño. Los documentos permanentes explican el
> *porqué*; el estado vive en los archivos de arriba, que se reescriben cada sesión.

## Nota sobre el idioma

La documentación está en español. `validate-harness.mjs` busca encabezados en inglés, así que
los títulos de sección canónicos del harness (`Startup Workflow`, `Definition of Done`,
`Verification Commands`, `End of Session`) se mantienen en inglés a propósito: son vocabulario
técnico del curso y permiten que la herramienta de medición funcione. El contenido va en
español.
