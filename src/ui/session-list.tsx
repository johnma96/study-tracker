import type { SessionListItem } from '@/core/services/session-listing';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/primitives/table';
import { formatCivilDate, formatMinutes } from '@/ui/stats-format';

/**
 * RF-30 — sesiones de un programa: fecha, tipo, duración efectiva y nota.
 *
 * El orden ya viene decidido por `core/services/session-listing.ts`. La tabla
 * es además la vista accesible del mapa de calor: los mismos datos, en texto.
 */

/** Filas visibles. El resto existe y cuenta en los totales; solo no se pinta. */
export const VISIBLE_SESSIONS = 15;

export function SessionList({
  items,
  typeLabels,
}: {
  items: readonly SessionListItem[];
  /** Etiqueta `código · nombre` por identificador de tipo de sesión. */
  typeLabels: ReadonlyMap<string, string>;
}) {
  const visible = items.slice(0, VISIBLE_SESSIONS);

  return (
    <Table>
      {items.length > VISIBLE_SESSIONS ? (
        <TableCaption>
          Las {VISIBLE_SESSIONS} más recientes de {items.length}.
        </TableCaption>
      ) : null}
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead className="text-right">Duración</TableHead>
          <TableHead>Nota</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visible.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              {formatCivilDate(item.date)}{' '}
              <span className="text-muted-foreground">{item.startTime}</span>
            </TableCell>
            <TableCell>
              {item.sessionTypeId ? (typeLabels.get(item.sessionTypeId) ?? '—') : '—'}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {item.minutes === null ? (
                <span className="text-muted-foreground">en curso</span>
              ) : (
                formatMinutes(item.minutes)
              )}
            </TableCell>
            <TableCell className="max-w-56 truncate whitespace-normal" title={item.note ?? undefined}>
              {item.note ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
