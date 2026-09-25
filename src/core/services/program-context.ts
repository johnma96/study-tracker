/**
 * R8 — contexto de programa: qué programa gobierna lo que se ve.
 *
 * **El contexto vive en la URL** (`/?programa=<id>`), no en estado de cliente.
 * Esa decisión es de `docs/ROADMAP.md` y tiene tres consecuencias que este
 * módulo hace posibles: la selección es compartible, sobrevive a recargar y la
 * lee un Server Component sin ningún `useState`.
 *
 * Dominio puro. Aquí no se sabe nada de Next, de React ni de la base: lo único
 * que entra es el valor crudo del parámetro y listas de cosas que pertenecen a
 * un programa. Por eso el filtrado se prueba sin base de datos, que es lo que
 * exige la *Definition of Done* de `AGENTS.md` y la justificación declarada de
 * la separación por capas (`docs/ARCHITECTURE.md`, sección Capas).
 *
 * **Un solo dueño del filtro.** Todo lo que se recorta por programa —sesiones,
 * métricas, evidencia, opciones de un formulario— pasa por estas funciones. La
 * alternativa, que cada sección filtre por su cuenta, es el defecto que ya
 * mordió dos veces en este repositorio: dos definiciones de la misma regla se
 * desincronizan sin que nada avise.
 */

/** Valor del parámetro que significa «todos los programas». */
export const ALL_PROGRAMS = 'todos';

/** Nombre del parámetro de consulta que transporta el contexto. */
export const PROGRAM_PARAM = 'programa';

/**
 * El contexto activo.
 *
 * Es una unión discriminada y no `string | null` para que ninguna vista pueda
 * confundir «todos» con «ninguno»: son cosas distintas y el segundo caso no
 * existe.
 */
export type ProgramContext =
  | { readonly kind: 'all' }
  | { readonly kind: 'program'; readonly programId: string };

/** El contexto por defecto: sin selección, se ve todo. */
export const ALL_PROGRAMS_CONTEXT: ProgramContext = { kind: 'all' };

/** Lo mínimo que hace falta para identificar un programa. */
interface HasId {
  readonly id: string;
}

/** Cualquier cosa que pertenezca a un programa. */
interface HasProgramId {
  readonly programId: string;
}

/**
 * Resuelve el contexto a partir del valor crudo que venga en la URL.
 *
 * **Nada de lo que llegue por aquí es de fiar.** El parámetro lo escribe quien
 * quiera: puede faltar, venir repetido (`?programa=a&programa=b`, que Next
 * entrega como arreglo), traer un identificador que ya no existe —un programa
 * borrado, un enlace viejo— o ser basura. En todos esos casos la respuesta es
 * «todos», nunca un error: un enlace mal escrito no puede dejar la página en
 * blanco.
 *
 * La validación es por **pertenencia a la lista de programas reales**, no por
 * forma. Comprobar que "parece un UUID" aceptaría identificadores inexistentes
 * y obligaría a un caso de error más abajo; comparar contra lo que existe
 * resuelve los dos problemas de una vez y no deja ninguna cadena del usuario
 * llegando a una consulta.
 */
export function resolveProgramContext(
  raw: string | readonly string[] | undefined | null,
  programs: readonly HasId[],
): ProgramContext {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return ALL_PROGRAMS_CONTEXT;

  const candidate = value.trim();
  if (candidate === '' || candidate === ALL_PROGRAMS) return ALL_PROGRAMS_CONTEXT;

  const exists = programs.some((program) => program.id === candidate);
  return exists ? { kind: 'program', programId: candidate } : ALL_PROGRAMS_CONTEXT;
}

/** El valor que le corresponde al contexto en la URL. */
export function programContextParam(context: ProgramContext): string {
  return context.kind === 'all' ? ALL_PROGRAMS : context.programId;
}

/** ¿Es este el programa del contexto? Con «todos», ninguno lo es en exclusiva. */
export function isSelectedProgram(context: ProgramContext, programId: string): boolean {
  return context.kind === 'program' && context.programId === programId;
}

/**
 * El programa del contexto, o `null` con «todos».
 *
 * Es lo que preseleccionan el cronómetro y el registro manual: con un programa
 * elegido, el formulario ya viene apuntando ahí; con «todos», el usuario elige.
 */
export function selectedProgramId(context: ProgramContext): string | null {
  return context.kind === 'all' ? null : context.programId;
}

/**
 * Filtra por el contexto cualquier lista de cosas que pertenezcan a un
 * programa: sesiones, métricas, opciones de sesión, tipos de sesión.
 *
 * Con «todos» devuelve una copia de todo. Devolver una copia y no la misma
 * referencia mantiene el contrato igual en los dos caminos: quien recibe el
 * resultado puede ordenarlo en sitio sin alterar la lista original.
 */
export function filterByProgramContext<T extends HasProgramId>(
  items: readonly T[],
  context: ProgramContext,
): T[] {
  if (context.kind === 'all') return [...items];
  return items.filter((item) => item.programId === context.programId);
}

/**
 * Los programas visibles en el contexto: todos, o solo el elegido.
 *
 * Conserva el orden de entrada, que ya viene resuelto por `program-order.ts`
 * (RF-13). Reordenar aquí sería un segundo dueño de la misma regla.
 */
export function programsInContext<T extends HasId>(
  programs: readonly T[],
  context: ProgramContext,
): T[] {
  if (context.kind === 'all') return [...programs];
  return programs.filter((program) => program.id === context.programId);
}

/**
 * Filtra la evidencia por el contexto (R4, RF-50 a RF-53).
 *
 * Tiene función propia porque el programa cuelga de `session`, un nivel más
 * abajo que en el resto. Se tipa por forma y no importando el puerto de
 * artefactos: la regla es la misma independientemente de qué proyección de
 * sesión llegue.
 */
export function filterSessionEvidenceByProgramContext<
  T extends { readonly session: HasProgramId },
>(items: readonly T[], context: ProgramContext): T[] {
  if (context.kind === 'all') return [...items];
  return items.filter((item) => item.session.programId === context.programId);
}

/**
 * RF-36 — sesiones planeadas del contexto.
 *
 * Con un programa elegido es su propio valor. Con «todos» es la **suma** de las
 * que declaran alguna: si dos programas planean 30 y 20 sesiones, el total
 * pendiente del que proyectar son 50. Los programas sin plan no aportan, y si
 * ninguno declara nada el resultado es `null` —no cero—, porque «no hay plan»
 * y «el plan es cero» llevan a proyecciones distintas.
 */
export function plannedSessionsInContext(
  programs: readonly (HasId & { readonly plannedSessions: number | null })[],
  context: ProgramContext,
): number | null {
  const scope = programsInContext(programs, context);
  const declared = scope.filter((program) => program.plannedSessions !== null);

  if (declared.length === 0) return null;
  return declared.reduce((total, program) => total + (program.plannedSessions ?? 0), 0);
}
