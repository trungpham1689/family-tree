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

  const altNames = [person.common_name, person.courtesy_name].filter((name): name is string => Boolean(name?.trim()));
  if (altNames.length > 0) sentences.push(`Còn gọi là ${altNames.join(', ')}.`);

  if (placement.kind === 'thuy_to') {
    sentences.push('Thuỷ tổ của dòng họ, người đời đầu tiên còn ghi lại được.');
  } else {
    if (person.birth_order !== null) sentences.push(`${birthOrderLabel(person.birth_order)}.`);
    const parents = graph.parentsOf(person.id).map((p) => p.person.full_name);
    if (parents.length > 0) sentences.push(`Con của ${parents.join(' và ')}.`);
  }

  if (person.hometown) sentences.push(`Quê quán ${person.hometown.trim()}.`);
  if (person.residence && person.residence.trim() !== person.hometown?.trim()) {
    sentences.push(`Sinh sống tại ${person.residence.trim()}.`);
  }

  const spouses = graph.spousesOf(person.id).map((s) => s.person.full_name);
  if (spouses.length > 0) sentences.push(`Kết hôn với ${spouses.join(', ')}.`);

  if (person.title) sentences.push(`${person.title.trim()}.`);
  if (person.role_note) sentences.push(`${person.role_note.trim()}.`);
  if (person.occupation) sentences.push(`Nghề nghiệp: ${person.occupation}.`);
  if (person.education) sentences.push(`Học vấn: ${person.education.trim()}.`);

  if (person.is_deceased) {
    const age = ageAtDeath(person);
    sentences.push(age !== null ? `Mất, ${deathAgeLabel(age).toLowerCase()} ${age} tuổi.` : 'Đã mất.');
    if (person.burial_place) sentences.push(`An táng tại ${person.burial_place.trim()}.`);
    if (person.worship_place) sentences.push(`Thờ phụng tại ${person.worship_place.trim()}.`);
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

export type OriginSummary = {
  progenitorId: string | null;
  progenitorName: string | null;
  hometown: string | null;
  anniversaryDay: number | null;
  anniversaryMonth: number | null;
  worshipPlace: string | null;
  worshipKeeper: string | null;
  burialPlace: string | null;
};

/** Nguồn gốc dòng họ: suy từ hồ sơ Thuỷ tổ — quê quán, giỗ, nơi thờ, mộ phần. */
export const originSummary = (graph: FamilyGraph<Person>): OriginSummary => {
  const progenitor = graph.persons.find((person) => graph.placement(person.id).kind === 'thuy_to') ?? null;
  return {
    progenitorId: progenitor?.id ?? null,
    progenitorName: progenitor?.full_name ?? null,
    hometown: progenitor?.hometown ?? null,
    anniversaryDay: progenitor?.anniversary_day ?? null,
    anniversaryMonth: progenitor?.anniversary_month ?? null,
    worshipPlace: progenitor?.worship_place ?? null,
    worshipKeeper: progenitor?.worship_keeper ?? null,
    burialPlace: progenitor?.burial_place ?? null,
  };
};

export type BranchSummary = { branchId: string; founderName: string; memberCount: number };

/**
 * Mỗi chi do một con của Thuỷ tổ (Đời 2) lập ra — branchId đã tính sẵn trong Phả đồ
 * (RPC tree_positions): người đó chính là tổ của chi.
 */
export const branchSummaries = (graph: FamilyGraph<Person>): BranchSummary[] => {
  const counts = new Map<string, number>();
  for (const person of graph.persons) {
    const branchId = graph.placement(person.id).branchId;
    if (branchId) counts.set(branchId, (counts.get(branchId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .flatMap(([branchId, memberCount]) => {
      const founder = graph.person(branchId);
      return founder ? [{ branchId, founderName: founder.full_name, memberCount }] : [];
    })
    .sort((a, b) => b.memberCount - a.memberCount);
};

/** Lời kết tự sinh: ghi rõ đây là bản suy từ dữ liệu điện tử, ngày xem, nhắn gửi con cháu bổ sung. */
export const closingNote = (today: { day: number; month: number; year: number }): string =>
  `Phả ký này lập tự động từ dữ liệu đã ghi trong Gia phả điện tử, tính đến ngày ${today.day}/${today.month}/${today.year}. ` +
  'Mong con cháu đời sau tiếp tục bổ sung những gì còn thiếu, và giữ gìn nếp nhà cùng việc giỗ chạp của dòng họ.';
