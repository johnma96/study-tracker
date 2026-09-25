import { describe, expect, it } from 'vitest';

import type { Artifact } from '../model/artifact';

import { groupArtifactsBySession } from './artifact-grouping';

const at = new Date('2026-09-25T15:00:00Z');

function artifact(id: string, sessionId: string): Artifact {
  return { id, sessionId, kind: 'link', label: id, target: 'https://ejemplo.org', createdAt: at };
}

describe('groupArtifactsBySession (RF-52)', () => {
  it('reparte los artefactos por sesión y conserva el orden de entrada', () => {
    const grouped = groupArtifactsBySession([
      artifact('a1', 's1'),
      artifact('b1', 's2'),
      artifact('a2', 's1'),
    ]);

    expect(grouped.get('s1')?.map((item) => item.id)).toEqual(['a1', 'a2']);
    expect(grouped.get('s2')?.map((item) => item.id)).toEqual(['b1']);
  });

  it('una sesión sin artefactos no aparece: quien consulta usa ?? []', () => {
    expect(groupArtifactsBySession([]).get('s1')).toBeUndefined();
  });
});
