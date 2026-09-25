'use client';

import { useEffect, useRef, useState } from 'react';

import {
  effectiveSecondsSoFar,
  formatSeconds,
  openPauseSeconds,
} from '@/core/services/session-duration';
import { toTiming, type RunningSessionView } from '@/ui/session-view';

/**
 * RF-21, RF-2B — el reloj que corre en pantalla.
 *
 * **Es presentación, no una fuente de verdad.** En cada tic vuelve a calcular
 * `ahora − startedAt − pausas` con la misma función de `core/services` que usa
 * el servidor, partiendo del valor que vino de la base. No acumula nada: no hay
 * ninguna variable que sume segundos. Por eso cerrar la pestaña, apagar el
 * equipo o abrir en otro dispositivo devuelve el tiempo correcto — el dato vive
 * en `sessions.started_at`, no aquí.
 *
 * El primer render usa el instante del servidor para que la hidratación
 * coincida con el HTML. A partir de ahí el navegador marca el paso del tiempo,
 * pero **anclado al reloj de la base**: se guarda una vez la diferencia entre
 * los dos relojes y se aplica en cada tic. Sin ese anclaje, un navegador con la
 * hora desajustada mostraría un salto al hidratar.
 */
export function SessionClock({
  session,
  nowIso,
}: {
  session: RunningSessionView;
  nowIso: string;
}) {
  const [now, setNow] = useState(() => new Date(nowIso));
  const offsetRef = useRef(0);

  useEffect(() => {
    offsetRef.current = new Date(nowIso).getTime() - Date.now();

    const tick = () => setNow(new Date(Date.now() + offsetRef.current));

    tick();
    const timer = setInterval(tick, 1000);

    return () => clearInterval(timer);
  }, [nowIso]);

  const timing = toTiming(session);
  const effective = effectiveSecondsSoFar(timing, now);
  const paused = openPauseSeconds(timing, now);
  const isPaused = session.pausedAtIso !== null;

  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <p
        // `tabular-nums` evita que el ancho baile a cada segundo.
        className="font-mono text-3xl font-semibold tabular-nums"
        aria-live="off"
      >
        {formatSeconds(effective)}
      </p>

      <p className="text-sm opacity-70">
        {isPaused ? (
          <>
            Pausada hace <span className="font-mono tabular-nums">{formatSeconds(paused)}</span>
          </>
        ) : (
          'tiempo efectivo'
        )}
      </p>
    </div>
  );
}
