# PRODUCT.md — qué es y qué no es

## Problema

Llevo varios programas de aprendizaje en paralelo y en el tiempo: cursos técnicos,
certificaciones de plataforma, diplomados formales, autoestudio. Hoy no tengo forma de
responder tres preguntas básicas:

- ¿Cuánto tiempo real le dediqué a cada uno?
- ¿Qué produje en cada sesión y dónde está esa evidencia?
- ¿A qué velocidad avanzo, y cuándo terminaría si sigo a este ritmo?

Las herramientas existentes resuelven **una** de las tres. Los cronómetros (Toggl, Clockify)
miden tiempo pero no saben nada del programa. Los rastreadores de IDE (WakaTime) cuentan
tecleo en el editor, no lectura ni espera de agente. Los sistemas de notas (Obsidian) guardan
evidencia pero no cuantifican. Ninguno junta las tres.

## Usuario

Un solo usuario: yo. La aplicación se diseña para un individuo que estudia por su cuenta y
quiere evidencia de su propio avance. El soporte multiusuario está contemplado en el modelo
de datos pero **no se construye** hasta que exista una necesidad real.

## Principio de diseño central

**Cada programa mide el progreso de forma distinta.**

| Programa | Métrica natural |
|---|---|
| Harness Engineering | score 0-100 de `validate-harness.mjs` |
| Certificación de plataforma | módulos completados / total |
| Diplomado formal | nota por corte |
| Curso de programación | ejercicios que pasan sus pruebas |

Por eso el progreso **no** se modela como un porcentaje único. Cada programa define sus
propias métricas, y el sistema grafica cualquier serie sin saber qué significa. Esta es la
decisión que permite que el producto sirva para el segundo programa y no solo para el primero.

## Alcance del MVP

El MVP entrega el ciclo mínimo útil:

1. Registrar programas.
2. Cronometrar una sesión de estudio y guardar su duración.
3. Ver los días trabajados y las horas acumuladas.
4. Adjuntar evidencia enlazable a cada sesión.
5. Registrar métricas propias del programa y verlas en el tiempo.

Después de la rebanada 2 (cronómetro + persistencia + listado) la herramienta **ya es útil**.
Todo lo demás es visualización sobre datos que ya se están capturando. Ese es el criterio para
saber si el corte del MVP está bien hecho.

## Fuera de alcance — no construir

Esta lista es vinculante. Si una tarea implica algo de aquí, se detiene y se consulta.

- Multiusuario, equipos, roles o permisos.
- Subida de archivos. La evidencia se referencia por URL o por ruta, no se almacena.
- Aplicación móvil nativa.
- Importadores automáticos desde plataformas de terceros.
- Notificaciones, recordatorios o correos.
- Integración con calendario.
- Gamificación: rachas competitivas, insignias, puntajes sociales.
- Modo sin conexión con sincronización.
- Analítica con IA o recomendaciones automáticas de estudio.
- Exportación a PDF.

## No-objetivos de producto

- **No es un gestor de tareas.** No lleva pendientes ni listas de cosas por hacer.
- **No es un sistema de notas.** Las notas viven en sus repositorios; aquí se enlazan.
- **No busca precisión de facturación.** Un error de un par de minutos es irrelevante; lo que
  importa es la cadencia sostenida en semanas.

## Cómo se sabe que el producto funciona

La prueba de aceptación real no es técnica: **si después de un mes de uso puedo responder las
tres preguntas del problema sin abrir otra herramienta, el producto funciona.** Si tengo que
completar datos a mano al final de la semana porque olvidé usarlo, falló — y la causa será
fricción en el registro, no falta de features.
