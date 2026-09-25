import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Configuración de las pruebas de integración (R2).
 *
 * Están separadas de `vitest.config.mts` a propósito. Aquella recoge solo
 * `src/core/**` y corre sin red ni base de datos, por lo que puede formar parte
 * de `./init.sh` y de un clon limpio sin `.env`. Estas necesitan el branch `dev`
 * de Neon: mezclarlas volvería la puerta de entrada del repositorio dependiente
 * de la red, y un fallo de conexión se leería como código roto.
 *
 * Lo que se prueba aquí es exactamente lo que **no tiene sentido** probar sin
 * base de datos: que el tiempo se deriva de la marca almacenada, que el índice
 * único rechaza la segunda sesión en curso y que el flujo de recuperación libera
 * ese índice.
 *
 * Se ejecutan con `npm run test:integration`, que carga `DATABASE_URL` desde
 * `.env` con `node --env-file`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    // Cada aserción cruza la red hasta Neon: el tope por defecto de 5 s se
    // queda corto en un primer arranque en frío.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Las pruebas comparten una única fila "sesión en curso" impuesta por el
    // índice: en paralelo se estorbarían entre ellas.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
