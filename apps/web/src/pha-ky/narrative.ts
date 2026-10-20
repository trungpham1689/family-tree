import type { Person } from '../data/trees';
import type { FamilyGraph, PersonKind } from '../family/family-graph';
import { birthOrderLabel } from '../family/labels';
import { ageAtDeath, deathAgeLabel, lifespanText } from '../people/person-display';

/**
 * Phả ký: văn bản tường thuật từng Người theo Đời, khác Phả đồ (sơ đồ hình).
 * Suy thẳng từ dữ liệu đã có — không cần lưu thêm gì.
 */

/** `text` gộp sẵn cho PDF (văn xuôi thuần); `name`/`lifespan`/`detail` tách riêng để web trình bày nổi bật. */
export type NarrativeItem = {
  personId: string;
  kind: PersonKind;
  gender: string | null;
  adopted: boolean;
  name: string;
  lifespan: string | null;
  /** Các câu mô tả nối thành một đoạn (dùng cho tìm kiếm, kiểm thử). */
  detail: string;
  /** Mỗi nội dung (nguyên quán, nơi ở, kết hôn…) một dòng, để dễ đọc ở web và PDF. */
  lines: string[];
  text: string;
};
export type NarrativeGeneration = { generation: number; male: number; female: number; total: number; items: NarrativeItem[] };

/** Giá trị người dùng gõ tự do: bỏ khoảng trắng và dấu câu cuối, để ghép câu không bị ".." hay dính vào câu sau. */
const clean = (value: string | null | undefined): string => (value ?? '').trim().replace(/[\s.,;:]+$/u, '');

/** Câu "Nhãn: giá trị." — nhãn luôn đứng riêng để các mục hồ sơ không dính chùm vào nhau; không có giá trị thì không có câu. */
const labelled = (label: string, value: string | null | undefined): string[] => {
  const text = clean(value);
  return text ? [`${label}: ${text}.`] : [];
};

const personNarrative = (graph: FamilyGraph<Person>, person: Person): { lifespan: string | null; detail: string; lines: string[]; text: string } => {
  const placement = graph.placement(person.id);
  const lifespan = lifespanText(person);
  const sentences: string[] = [];

  const commonName = clean(person.common_name);
  if (commonName) sentences.push(`Còn gọi là ${commonName}.`);
  sentences.push(...labelled('Tên tự / hiệu', person.courtesy_name));

  if (placement.kind === 'thuy_to') {
    sentences.push('Thuỷ tổ của dòng họ, người đời đầu tiên còn ghi lại được.');
  } else {
    if (person.birth_order !== null) sentences.push(`${birthOrderLabel(person.birth_order)}.`);
    const parents = graph.parentsOf(person.id).map((p) => p.person.full_name);
    if (parents.length > 0) sentences.push(`Con của ${parents.join(' và ')}.`);
  }

  sentences.push(...labelled('Nơi sinh', person.birth_place));
  sentences.push(...labelled('Nguyên quán', person.hometown));
  if (clean(person.residence) && clean(person.residence) !== clean(person.hometown)) {
    sentences.push(`Sinh sống tại ${clean(person.residence)}.`);
  }

  const spouses = graph.spousesOf(person.id).map((s) => s.person.full_name);
  if (spouses.length > 0) sentences.push(`Kết hôn với ${spouses.join(', ')}.`);

  sentences.push(...labelled('Chức vụ / danh hiệu', person.title));
  sentences.push(...labelled('Vai vế', person.role_note));
  sentences.push(...labelled('Nghề nghiệp', person.occupation));
  sentences.push(...labelled('Học vấn', person.education));

  if (person.is_deceased) {
    const age = ageAtDeath(person);
    sentences.push(age !== null ? `Mất, ${deathAgeLabel(age).toLowerCase()} ${age} tuổi.` : 'Đã mất.');
    if (clean(person.burial_place)) sentences.push(`An táng tại ${clean(person.burial_place)}.`);
    if (clean(person.worship_place)) sentences.push(`Thờ phụng tại ${clean(person.worship_place)}.`);
  }

  if (person.biography) sentences.push(person.biography.trim());

  const heading = `${person.full_name}${lifespan ? ` (${lifespan})` : ''}.`;
  const detail = sentences.join(' ');
  return { lifespan: lifespan || null, detail, lines: sentences, text: [heading, ...sentences].join(' ') };
};

export const buildNarrative = (graph: FamilyGraph<Person>): NarrativeGeneration[] =>
  graph.generations().map((group) => ({
    generation: group.generation,
    male: group.male,
    female: group.female,
    total: group.total,
    items: group.persons.map((person) => {
      const { lifespan, detail, lines, text } = personNarrative(graph, person);
      return { personId: person.id, kind: graph.placement(person.id).kind, gender: person.gender, adopted: graph.parentsOf(person.id).some((parent) => parent.kind === 'nuoi'), name: person.full_name, lifespan, detail, lines, text };
    }),
  }));

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
    // Người phụ trách giờ là một Người được chọn (worship_keeper_id); cột chữ cũ chỉ còn ở dữ liệu trước đây.
    worshipKeeper: (progenitor?.worship_keeper_id ? graph.person(progenitor.worship_keeper_id)?.full_name : null) ?? progenitor?.worship_keeper ?? null,
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
