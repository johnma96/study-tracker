import type { Session } from '../model/session';

/**
 * Puerto de lectura del historial de sesiones (R3).
 *
 * Separado de `SessionRepository` a propósito: aquel aplica las transiciones
 * del cronómetro y vuelve a comprobar el estado dentro de cada `UPDATE`; este
 * solo lee lo que ya ocurrió para calcular totales, racha, cadencia y mapa de
 * calor. Los cálculos viven en `core/services/study-stats.ts` y
 * `session-listing.ts` y reciben la lista tal como sale de aquí.
 */
export interface SessionHistoryRepository {
  /**
   * Todas las sesiones de todos los programas, incluida la que esté en curso.
   *
   * Sin filtrar ni agregar en SQL: el día de cada sesión se decide en `core/`
   * con la zona de Colombia (RF-00, RF-32), que es la regla que cubren las
   * pruebas sin base de datos. Con un solo usuario, el volumen es de cientos de
   * filas; si algún día importa, el filtro por fecha se baja a la consulta y
   * las pruebas siguen siendo el contrato.
   */
  listAll(): Promise<Session[]>;
}
