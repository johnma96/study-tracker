# REQUIREMENTS.md — requerimientos funcionales

Formato **EARS** (Easy Approach to Requirements Syntax). Cada requerimiento usa uno de estos
patrones:

| Patrón | Forma |
|---|---|
| Ubicuo | El sistema debe `<respuesta>` |
| Por evento | Cuando `<disparador>`, el sistema debe `<respuesta>` |
| Por estado | Mientras `<estado>`, el sistema debe `<respuesta>` |
| No deseado | Si `<condición>`, entonces el sistema debe `<respuesta>` |
| Opcional | Donde `<característica>`, el sistema debe `<respuesta>` |

Cada feature de `feature_list.json` cita el o los `RF-XX` que implementa. Un `RF` sin prueba
automatizada no se considera implementado.

---

## Convenciones transversales

**RF-00 — Zona horaria.** El sistema debe interpretar y presentar todas las fechas en la zona
horaria `America/Bogota`, independientemente de la zona del servidor o del navegador.

> Esto no es un detalle. "Días trabajados" y "racha" dependen de dónde cae la medianoche. Una
> sesión que empieza a las 23:40 y termina a las 00:20 cuenta como **un** día trabajado: el
> del inicio. Almacena siempre en UTC (`timestamptz`); convierte solo al presentar y al
> agrupar por día.

**RF-01 — Persistencia.** El sistema debe almacenar todo dato de sesión en la base de datos
en el momento en que ocurre, y no depender del estado del navegador para no perder información.

---

## Bloque 1 — Programas

**RF-10.** El sistema debe permitir crear un programa con: nombre (obligatorio), proveedor,
tipo, estado, fecha de inicio y fecha objetivo.

**RF-11.** El sistema debe aceptar estos tipos de programa: `course`, `certification`,
`diploma`, `bootcamp`, `selfstudy`.

**RF-12.** El sistema debe aceptar estos estados de programa: `planned`, `active`, `paused`,
`done`, `abandoned`.

**RF-13.** El sistema debe listar los programas ordenados por estado (`active` primero) y
luego por fecha de inicio descendente.

**RF-14.** Si el nombre del programa está vacío o supera 120 caracteres, entonces el sistema
debe rechazar la operación y mostrar el motivo.

**RF-15.** El sistema debe permitir definir tipos de sesión propios de cada programa, con
código corto y etiqueta. Ejemplo para Harness Engineering: `E` Estudio, `C` Construcción,
`K` Consolidación, `V` Checkpoint.

> Los tipos de sesión **no** son un enum global. Un diplomado tiene "clase" y "taller"; un
> bootcamp tiene "lab". Si los codificas como enum fijo, el segundo programa te obliga a
> migrar el esquema.

---

## Bloque 2 — Cronómetro de sesión (núcleo del MVP)

**RF-20.** Cuando el usuario inicia una sesión para un programa, el sistema debe crear un
registro de sesión con la marca de tiempo de inicio y dejarlo **sin** marca de fin.

**RF-21.** Mientras exista una sesión sin marca de fin, el sistema debe mostrarla como sesión
en curso, con el tiempo transcurrido calculado como `ahora − inicio`.

> **Crítico:** el tiempo transcurrido se **deriva** de la marca de inicio almacenada. No lo
> acumules en un contador de JavaScript. Si el usuario cierra la pestaña, apaga el equipo o
> recarga la página, al volver debe ver la sesión todavía corriendo con el tiempo correcto.
> Esta es la diferencia entre un cronómetro que sirve y uno que pierde datos.

**RF-22.** Si ya existe una sesión en curso y el usuario intenta iniciar otra, entonces el
sistema debe rechazar la operación e indicar cuál sesión está abierta.

> Restricción de integridad, no solo validación de interfaz. Se impone en la base de datos con
> un índice único parcial (ver `docs/DATA-MODEL.md`). Una validación que vive solo en el
> cliente se salta con dos pestañas abiertas.

**RF-23.** Cuando el usuario detiene la sesión en curso, el sistema debe registrar la marca de
fin y calcular la duración efectiva.

**RF-24.** El sistema debe calcular la duración efectiva así: si existe `minutes_override`,
ese es el valor; si no, `(fin − inicio) − tiempo total en pausa`, redondeado al minuto más
cercano.

**RF-25.** Cuando el usuario detiene una sesión cuya duración supera las 8 horas, el sistema
debe pedir confirmación y ofrecer corregir la duración antes de guardar.

> Caso real y frecuente: se te olvidó detener el cronómetro y lo notas al día siguiente. Sin
> esto, un olvido mete 14 horas falsas y arruina todas las estadísticas. `minutes_override`
> existe para eso.

**RF-26.** El sistema debe permitir registrar una sesión de forma manual, indicando fecha,
hora de inicio y duración, sin usar el cronómetro.

**RF-27.** El sistema debe permitir cancelar una sesión en curso, lo que la elimina en vez de
cerrarla.

**RF-28.** El sistema debe permitir asociar a cada sesión un tipo de sesión del programa, una
nota libre y los minutos de atasco (`stuck_minutes`).

> `stuck_minutes` registra el tiempo bloqueado sin avanzar. Es el dato que más enseña: marca
> dónde el modelo mental no alcanza. Por defecto 0.

**RF-29.** Si el usuario intenta detener una sesión cuando no hay ninguna en curso, entonces
el sistema debe informarlo sin generar error.

---

## Bloque 2b — Pausas

> Las pausas no son un lujo: la estructura de sesión de estudio prevista tiene un descanso
> intermedio. Sin este bloque quedan dos malas opciones — fragmentar el registro en dos
> sesiones, o dejar correr el reloj durante el descanso e inflar los minutos.

**RF-2A.** Cuando el usuario pausa la sesión en curso, el sistema debe registrar el instante
de la pausa y dejar de acumular tiempo efectivo.

**RF-2B.** Mientras la sesión esté pausada, el sistema debe mostrarla como pausada, con el
tiempo efectivo acumulado hasta el momento de pausar y el tiempo que lleva en pausa.

**RF-2C.** Cuando el usuario reanuda una sesión pausada, el sistema debe sumar el intervalo de
la pausa al total acumulado de pausa y volver a acumular tiempo efectivo.

**RF-2D.** Si el usuario detiene una sesión que está pausada, entonces el sistema debe cerrar
la pausa abierta antes de calcular la duración efectiva.

**RF-2E.** El sistema debe permitir pausar y reanudar cualquier número de veces dentro de una
misma sesión.

---

## Bloque 2c — Recuperación de sesión abandonada

> **Este bloque existe porque la restricción de "máximo una sesión en curso" puede producir un
> punto muerto.** Si el navegador se cierra sin llamar al cierre de la sesión, esa sesión queda
> abierta de forma indefinida y el índice único impide iniciar cualquier otra. El mecanismo que
> da robustez es el mismo que puede bloquear la aplicación.

**RF-2F.** El sistema debe permitir cerrar o descartar la sesión en curso desde cualquier
vista, sin depender de la pantalla donde se inició. Una sesión abandonada nunca debe poder
bloquear de forma permanente el inicio de una nueva.

**RF-2G.** Cuando el usuario abre la aplicación y existe una sesión en curso cuyo inicio
supera las 8 horas, el sistema debe presentar un diálogo de recuperación con tres opciones:
cerrarla indicando la duración real, descartarla, o continuarla.

**RF-2H.** Si el usuario cierra una sesión desde el diálogo de recuperación indicando una
duración, entonces el sistema debe guardar ese valor en `minutes_override`.

**RF-2I.** El sistema debe mostrar el estado de la sesión en curso —corriendo o pausada— en
todas las vistas, no solo en la del cronómetro.

---

## Bloque 3 — Listado y totales

**RF-30.** El sistema debe listar las sesiones de un programa ordenadas por fecha de inicio
descendente, mostrando fecha, tipo, duración efectiva y nota.

**RF-31.** El sistema debe calcular y mostrar, por programa: días distintos trabajados, horas
totales, duración media por sesión y número de sesiones.

**RF-32.** El sistema debe calcular los días distintos trabajados agrupando por la fecha local
(`America/Bogota`) de la marca de **inicio** de cada sesión.

**RF-33.** El sistema debe mostrar un mapa de calor de calendario donde cada celda es un día y
la intensidad representa los minutos trabajados ese día.

**RF-34.** El sistema debe calcular la racha actual como el número de días consecutivos, hasta
hoy, con al menos una sesión.

**RF-35.** El sistema debe mostrar la cadencia como sesiones por semana y minutos por semana
de las últimas 8 semanas.

**RF-36.** Donde el programa tenga un número total de sesiones planeadas, el sistema debe
proyectar una fecha estimada de finalización a partir de la cadencia de las últimas 4 semanas.

**RF-37.** Si un programa no tiene sesiones registradas, entonces el sistema debe mostrar un
estado vacío explicativo y no un error ni tableros en cero.

**RF-38 — Contexto de programa.** El sistema debe permitir elegir un programa que gobierne la
vista completa —mapa de calor, totales, racha, cadencia, proyección, métricas y evidencia— y
debe conservar esa elección en la URL. Sin elección explícita el contexto es «todos», y las
secciones agregan los datos de todos los programas.

> El contexto vive en la URL (`/?programa=<id>`), no en estado de cliente. No es un detalle de
> implementación: es lo que hace que la selección sea compartible, sobreviva a recargar y la
> pueda leer un Server Component. Un selector que necesite JavaScript para navegar incumple
> este requerimiento aunque en pantalla se vea igual.

**RF-39.** Si el programa indicado en la URL no existe o tiene un formato inválido, entonces el
sistema debe presentar la vista de «todos» sin error.

> Ese parámetro lo escribe cualquiera. La validación es por pertenencia a los programas que
> existen, no por forma: comprobar que «parece un identificador» aceptaría uno inexistente y
> dejaría la página rota ante un enlace viejo.

---

## Bloque 4 — Evidencia

**RF-50.** El sistema debe permitir adjuntar a una sesión cero o más artefactos, cada uno con
tipo, etiqueta y destino (URL o ruta relativa de repositorio).

**RF-51.** El sistema debe aceptar estos tipos de artefacto: `doc`, `image`, `repo`, `link`,
`commit`.

**RF-52.** El sistema debe mostrar los artefactos de una sesión como enlaces que abren en una
pestaña nueva.

**RF-53.** Donde el artefacto sea de tipo `image` y su destino sea una URL accesible, el
sistema debe mostrar una miniatura.

**RF-54.** El sistema **no** debe almacenar archivos. Solo guarda referencias.

---

## Bloque 5 — Métricas de progreso

**RF-60.** El sistema debe permitir definir métricas propias de cada programa, con nombre,
unidad, dirección de mejora (`up` o `down`) y valor objetivo opcional.

**RF-61.** El sistema debe permitir registrar lecturas de una métrica, con valor, fecha y
sesión asociada opcional.

**RF-62.** El sistema debe graficar cada métrica como serie de tiempo, con la línea de
objetivo cuando exista.

**RF-63.** El sistema debe indicar si la última lectura mejoró o empeoró respecto a la
anterior, según la dirección de mejora de la métrica.

> Con esto, el score de `validate-harness.mjs` del curso entra como una métrica más, sin que
> el sistema sepa qué es un harness. Esa es la prueba de que la generalización funciona.

---

## Bloque 6 — Seguridad y acceso

**RF-40.** Antes del primer despliegue público que contenga datos reales, el sistema debe
exigir autenticación para toda operación de lectura y escritura.

> **Diferido a propósito el 25/09/2026, con riesgo aceptado y por escrito.**
>
> La aplicación está desplegada y acepta escrituras sin autenticación. El riesgo se evaluó y se
> asumió: es un tracker personal, sin datos de terceros, sin credenciales y sin información que
> importe exponer. La URL no se ha compartido. El peor caso realista es que alguien escriba
> filas basura, que se borran.
>
> Dato que forma parte de la decisión: los subdominios `vercel.app` **son descubribles** a través
> de los registros públicos de transparencia de certificados. Que no se haya publicado la URL no
> equivale a que sea secreta.
>
> **Condiciones que vuelven `RF-40` obligatoria.** Al cumplirse cualquiera, R6 pasa a ser trabajo
> inmediato y anterior a cualquier otra rebanada:
>
> 1. Se comparte la URL con alguien, por cualquier medio.
> 2. La aplicación almacena algo que importe perder, exponer o ver alterado.
> 3. La usa una segunda persona.
> 4. Aparece actividad no reconocida: filas que nadie creó, o consumo anómalo en Neon o Vercel.
>
> Esta lista existe porque `RF-40` ya se incumplió una vez sin que nadie se enterara: era una
> compuerta sin ningún mecanismo que la hiciera cumplir. Ahora al menos tiene disparadores
> escritos.

**RF-41.** El sistema debe restringir el acceso a una lista blanca de correos configurada por
variable de entorno.

**RF-42.** Si un usuario autenticado no está en la lista blanca, entonces el sistema debe
negar el acceso y registrar el intento.

**RF-43.** El sistema no debe exponer secretos, cadenas de conexión ni variables de entorno en
el cliente.

**RF-44.** El sistema debe validar toda entrada en el servidor, sin confiar en la validación
del cliente.

> `RF-40` es una **compuerta**, no una etapa del cronograma. Mientras la base de datos solo
> tenga datos de prueba, puede esperar. En el momento en que registre sesiones reales, la
> aplicación está en internet público sin puerta.

---

## Trazabilidad

| Rebanada | Requerimientos | Entrega |
|---|---|---|
| 0 Esqueleto | RF-01 | Aplicación desplegada leyendo de la base |
| 1 Programas | RF-10 … RF-15 | Crear y listar programas |
| 2 **Cronómetro** | RF-00, RF-20 … RF-29 | **Registrar tiempo real** |
| 2b Pausas | RF-2A … RF-2E | Descansos sin inflar ni fragmentar |
| 2c Recuperación | RF-2F … RF-2I | Una sesión abandonada no bloquea |
| 3 Totales | RF-30 … RF-37 | Días, horas, mapa de calor, cadencia |
| 4 Evidencia | RF-50 … RF-54 | Artefactos enlazados |
| 5 Métricas | RF-60 … RF-63 | Series de progreso |
| 6 Acceso | RF-40 … RF-44 | Autenticación |
| 8 Contexto | RF-38, RF-39 | Un programa gobierna la página; la URL lo conserva |
