'use client';

import {
  discardSessionAction,
  pauseSessionAction,
  resumeSessionAction,
} from '@/app/session-actions';
import { SessionActionButton } from '@/ui/session-action-button';
import { SessionClock } from '@/ui/session-clock';
import { SessionRecoveryDialog } from '@/ui/session-recovery-dialog';
import type { SessionSnapshot } from '@/ui/session-view';
import { StopSessionForm } from '@/ui/stop-session-form';

/**
 * RF-2I, RF-2F — barra de estado de la sesión, presente en **todas** las vistas.
 *
 * La pinta el layout, no una página. Ese es justamente el requerimiento: el
 * estado de la sesión —corriendo o pausada— se ve desde cualquier pantalla, y
 * desde cualquier pantalla se puede detener o descartar. Si la única forma de
 * cerrarla estuviera donde se inició, una sesión olvidada bloquearía la
 * aplicación entera.
 *
 * También es donde aparece el diálogo de recuperación de RF-2G, por la misma
 * razón: el usuario tiene que encontrarlo al abrir la aplicación, esté donde
 * esté.
 */
export function SessionBar({ snapshot }: { snapshot: SessionSnapshot }) {
  if (snapshot.unavailable) {
    return (
      <div className="border-b border-black/10 px-6 py-2 text-xs opacity-70 dark:border-white/15">
        No se pudo leer el estado de la sesión: la base de datos no respondió.
      </div>
    );
  }

  const session = snapshot.running;

  if (session === null) {
    return (
      <div className="border-b border-black/10 px-6 py-2 text-xs opacity-60 dark:border-white/15">
        Sin sesión en curso.
      </div>
    );
  }

  const isPaused = session.pausedAtIso !== null;
  const clock = <SessionClock session={session} nowIso={snapshot.nowIso} />;

  return (
    <div className="border-b border-black/10 dark:border-white/15">
      {session.abandoned ? (
        <div className="mx-auto w-full max-w-2xl px-6 py-4">
          <SessionRecoveryDialog session={session}>
            <div className="mt-4">{clock}</div>
          </SessionRecoveryDialog>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-4 px-6 py-3">
          <div>
            <p className="text-xs uppercase tracking-widest opacity-60">
              {isPaused ? 'Sesión pausada' : 'Sesión en curso'}
              {session.programName ? ` · ${session.programName}` : ''}
              {session.sessionTypeLabel ? ` · ${session.sessionTypeLabel}` : ''}
            </p>
            {clock}
          </div>

          <div className="flex flex-wrap items-start gap-2">
            {/*
              Las `key` distintas NO son decorativas y quitarlas reintroduce un
              defecto real: sin ellas los dos botones ocupan la misma posición y
              son el mismo componente, así que React **reutiliza la instancia**
              al alternar. `useActionState` conserva entonces su estado interno
              y la acción que tenía enlazada: el botón pasaba a decir «Pausar»
              mientras seguía ejecutando *reanudar*, y respondía «La sesión no
              estaba pausada». Recargar la página lo arreglaba, porque montaba
              una instancia nueva. Con `key`, React desmonta y vuelve a montar:
              la acción se reenlaza y el mensaje del paso anterior no se hereda.
            */}
            {isPaused ? (
              <SessionActionButton
                key="resume"
                action={resumeSessionAction}
                sessionId={session.id}
                label="Reanudar"
                pendingLabel="Reanudando…"
                tone="primary"
              />
            ) : (
              <SessionActionButton
                key="pause"
                action={pauseSessionAction}
                sessionId={session.id}
                label="Pausar"
                pendingLabel="Pausando…"
              />
            )}

            <StopSessionForm session={session} sessionTypes={[]} variant="compact" />

            {/* RF-27 — descartar borra la sesión: se confirma antes. */}
            <SessionActionButton
              action={discardSessionAction}
              sessionId={session.id}
              label="Descartar"
              pendingLabel="Descartando…"
              tone="danger"
              confirmMessage="Se borrará la sesión en curso y no quedará ninguna duración registrada. ¿Continuar?"
            />
          </div>
        </div>
      )}
    </div>
  );
}
