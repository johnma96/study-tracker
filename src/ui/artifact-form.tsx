'use client';

import { useActionState } from 'react';

import { attachArtifactAction } from '@/app/artifact-actions';
import { ARTIFACT_KINDS } from '@/core/model/artifact';
import { ARTIFACT_LABEL_MAX_LENGTH } from '@/core/services/artifact-input';
import { ARTIFACT_TARGET_MAX_LENGTH } from '@/core/services/artifact-target';
import { ARTIFACT_KIND_LABELS } from '@/ui/artifact-labels';
import { EMPTY_FORM_STATE } from '@/ui/form-state';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/primitives/select';

/**
 * RF-50, RF-51 — adjuntar un artefacto a una sesión.
 *
 * Los atributos `required` y `maxLength` son **conveniencia**, no control: la
 * validación que decide —tipos de RF-51, destino obligatorio, solo `http`/
 * `https` o ruta relativa— es la de la Server Action (RF-44). Por eso el
 * formulario muestra los motivos que devuelve el servidor y no duplica las
 * reglas en el navegador.
 *
 * El destino es un campo de texto y nunca un selector de archivo: la evidencia
 * se referencia, no se sube (RF-54).
 *
 * Hay un formulario por sesión en la misma página, así que los `id` llevan el
 * de la sesión para no repetirse.
 */
function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;

  return (
    <p id={id} role="alert" className="mt-1 text-xs text-destructive">
      {message}
    </p>
  );
}

export function ArtifactForm({ sessionId }: { sessionId: string }) {
  const [state, formAction, pending] = useActionState(attachArtifactAction, EMPTY_FORM_STATE);
  const prefix = `artifact-${sessionId}`;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="sessionId" value={sessionId} />

      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}-kind`}>Tipo</Label>
          <Select name="kind" defaultValue="link">
            <SelectTrigger id={`${prefix}-kind`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ARTIFACT_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {ARTIFACT_KIND_LABELS[kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id={`${prefix}-kind-error`} message={state.fieldErrors.kind} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}-label`}>Etiqueta</Label>
          <Input
            id={`${prefix}-label`}
            name="label"
            type="text"
            required
            maxLength={ARTIFACT_LABEL_MAX_LENGTH}
            placeholder="Qué es: «Roadmap actualizado», «Captura del tablero»…"
            aria-invalid={state.fieldErrors.label ? true : undefined}
            aria-describedby={state.fieldErrors.label ? `${prefix}-label-error` : undefined}
          />
          <FieldError id={`${prefix}-label-error`} message={state.fieldErrors.label} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${prefix}-target`}>Destino</Label>
        <Input
          id={`${prefix}-target`}
          name="target"
          type="text"
          inputMode="url"
          required
          maxLength={ARTIFACT_TARGET_MAX_LENGTH}
          placeholder="https://github.com/… o docs/archivo.md"
          aria-invalid={state.fieldErrors.target ? true : undefined}
          aria-describedby={`${prefix}-target-hint${state.fieldErrors.target ? ` ${prefix}-target-error` : ''}`}
          className="font-mono"
        />
        <p id={`${prefix}-target-hint`} className="text-xs text-muted-foreground">
          Una URL http o https, o una ruta relativa del repositorio. Nunca se sube el archivo.
        </p>
        <FieldError id={`${prefix}-target-error`} message={state.fieldErrors.target} />
      </div>

      <FieldError id={`${prefix}-session-error`} message={state.fieldErrors.sessionId} />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Adjuntando…' : 'Adjuntar evidencia'}
        </Button>

        {state.message ? (
          <p
            role="status"
            className={
              state.status === 'error'
                ? 'text-sm text-destructive'
                : 'text-sm text-green-700 dark:text-green-400'
            }
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
