'use client';

import { useState } from 'react';

/**
 * RF-53 — miniatura de un artefacto de tipo `image`.
 *
 * "Donde el destino sea una URL accesible" no se comprueba en el servidor:
 * pedir la URL desde allí sería SSRF. Lo comprueba el navegador al cargarla, y
 * si falla la miniatura desaparece y queda el enlace de texto, que ya está
 * pintado al lado. Es el único motivo por el que este componente es de cliente.
 *
 * `src` llega ya filtrado por `thumbnailSrc` de `core/services`: solo `http` y
 * `https`. `referrerPolicy="no-referrer"` evita que el servidor de la imagen
 * sepa desde qué página se cargó.
 *
 * Se usa `<img>` y no `next/image` a propósito: `next/image` exige declarar de
 * antemano cada dominio remoto en `next.config.ts`, y la evidencia puede estar
 * en cualquier parte.
 */
export function ArtifactThumbnail({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- ver el comentario del componente.
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="mt-2 max-h-40 w-auto max-w-full rounded-md border border-border object-contain"
    />
  );
}
