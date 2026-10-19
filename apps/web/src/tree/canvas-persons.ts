import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { lifespanText } from '../people/person-display';
import type { CanvasPerson } from './FamilyTreeCanvas';

/** Người của gia phả → dữ liệu vẽ trên Cây (nhãn tuổi thọ, Dâu/Rể, con nuôi, ảnh đại diện nếu có). */
export const toCanvasPersons = <P extends Person>(
  graph: FamilyGraph<P>,
  avatarUrlOf?: (personId: string) => string | undefined,
): Map<string, CanvasPerson> =>
  new Map(
    graph.persons.map((person) => [
      person.id,
      {
        id: person.id,
        full_name: person.full_name,
        gender: person.gender,
        is_deceased: person.is_deceased,
        lifespan: lifespanText(person),
        marriedIn: graph.placement(person.id).kind === 'dau_re',
        adopted: graph.parentsOf(person.id).some((parent) => parent.kind === 'nuoi'),
        avatarUrl: avatarUrlOf?.(person.id),
      },
    ]),
  );
