import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { birthOrderLabel } from '../family/labels';
import { ageAtDeath, deathAgeLabel, lifespanText } from '../people/person-display';

/**
 * Phả ký: văn bản tường thuật từng Người theo Đời, khác Phả đồ (sơ đồ hình).
 * Suy thẳng từ dữ liệu đã có — không cần lưu thêm gì.
 */

export type NarrativeItem = { personId: string; text: string };
export type NarrativeGeneration = { generation: number; items: NarrativeItem[] };

const personNarrative = (graph: FamilyGraph<Person>, person: Person): string => {
  const placement = graph.placement(person.id);
  const lifespan = lifespanText(person);
  const sentences: string[] = [];

  if (placement.kind === 'thuy_to') {
    sentences.push('Thuỷ tổ của dòng họ, người đời đầu tiên còn ghi lại được.');
  } else {
    if (person.birth_order !== null) sentences.push(`${birthOrderLabel(person.birth_order)}.`);
    const parents = graph.parentsOf(person.id).map((p) => p.person.full_name);
    if (parents.length > 0) sentences.push(`Con của ${parents.join(' và ')}.`);
  }

  const spouses = graph.spousesOf(person.id).map((s) => s.person.full_name);
  if (spouses.length > 0) sentences.push(`Kết hôn với ${spouses.join(', ')}.`);

  if (person.title) sentences.push(`${person.title.trim()}.`);
  if (person.occupation) sentences.push(`Nghề nghiệp: ${person.occupation}.`);

  if (person.is_deceased) {
    const age = ageAtDeath(person);
    sentences.push(age !== null ? `Mất, ${deathAgeLabel(age).toLowerCase()} ${age} tuổi.` : 'Đã mất.');
  }

  if (person.biography) sentences.push(person.biography.trim());

  const heading = `${person.full_name}${lifespan ? ` (${lifespan})` : ''}.`;
  return [heading, ...sentences].join(' ');
};

export const buildNarrative = (graph: FamilyGraph<Person>): NarrativeGeneration[] =>
  graph
    .generations()
    .map((group) => ({ generation: group.generation, items: group.persons.map((person) => ({ personId: person.id, text: personNarrative(graph, person) })) }));

export type NotablePerson = { personId: string; fullName: string; title: string; generation: number | null };

/** Người có điền Chức vụ/danh hiệu (chức tước, công trạng, học vị…) — dùng field có sẵn, không phân loại. */
export const notablePersons = (graph: FamilyGraph<Person>): NotablePerson[] =>
  graph.persons
    .filter((person): person is Person & { title: string } => Boolean(person.title?.trim()))
    .map((person) => ({
      personId: person.id,
      fullName: person.full_name,
      title: person.title.trim(),
      generation: graph.placement(person.id).generation,
    }))
    .sort((a, b) => (a.generation ?? Number.MAX_SAFE_INTEGER) - (b.generation ?? Number.MAX_SAFE_INTEGER));
