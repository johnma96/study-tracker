import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Configuración de Vitest.
 *
 * Solo se recogen pruebas de `src/core/`: es la capa que no importa nada de
 * `app/`, `infra/` ni `ui/` (regla de capas de docs/ARCHITECTURE.md), y por eso
 * su lógica se prueba sin levantar base de datos ni servidor. Esa es la
 * justificación real de la separación por capas, según el propio documento.
 *
 * El alias `@` replica el de `tsconfig.json` para que las pruebas importen con
 * las mismas rutas que el código de producción.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/core/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
