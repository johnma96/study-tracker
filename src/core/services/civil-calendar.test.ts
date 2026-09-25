import { describe, expect, it } from 'vitest';

import { addDays, daysBetween, isoWeekday, startOfWeek } from './civil-calendar';

describe('civil-calendar — aritmética de días sin zona del proceso', () => {
  it('suma y resta días cruzando fin de mes y de año', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('cuenta los días entre dos fechas', () => {
    expect(daysBetween('2026-09-01', '2026-09-25')).toBe(24);
    expect(daysBetween('2026-09-25', '2026-09-01')).toBe(-24);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('el día de la semana es ISO: lunes 1, domingo 7', () => {
    // 21/09/2026 es lunes; 27/09/2026, domingo.
    expect(isoWeekday('2026-09-21')).toBe(1);
    expect(isoWeekday('2026-09-25')).toBe(5);
    expect(isoWeekday('2026-09-27')).toBe(7);
  });

  it('la semana empieza el lunes, también para el domingo', () => {
    expect(startOfWeek('2026-09-21')).toBe('2026-09-21');
    expect(startOfWeek('2026-09-25')).toBe('2026-09-21');
    // El domingo pertenece a la semana que empezó el lunes anterior, no a la siguiente.
    expect(startOfWeek('2026-09-27')).toBe('2026-09-21');
    expect(startOfWeek('2026-10-01')).toBe('2026-09-28');
  });
});
