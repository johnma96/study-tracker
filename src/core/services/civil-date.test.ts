import { describe, expect, it } from 'vitest';

import { isCivilDate } from './civil-date';

describe('isCivilDate', () => {
  it('acepta una fecha válida', () => {
    expect(isCivilDate('2026-09-24')).toBe(true);
  });

  it('acepta el 29 de febrero de un año bisiesto', () => {
    expect(isCivilDate('2024-02-29')).toBe(true);
  });

  it('rechaza el 29 de febrero de un año no bisiesto', () => {
    // `new Date(Date.UTC(2026, 1, 29))` no falla: se desborda al 1 de marzo.
    expect(isCivilDate('2026-02-29')).toBe(false);
  });

  it('rechaza días y meses fuera de rango', () => {
    expect(isCivilDate('2026-13-01')).toBe(false);
    expect(isCivilDate('2026-04-31')).toBe(false);
  });

  it('rechaza formatos que no son AAAA-MM-DD', () => {
    expect(isCivilDate('24/09/2026')).toBe(false);
    expect(isCivilDate('2026-9-4')).toBe(false);
    expect(isCivilDate('2026-09-24T00:00:00Z')).toBe(false);
    expect(isCivilDate('')).toBe(false);
  });
});
