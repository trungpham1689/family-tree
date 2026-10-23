import type { Person } from '../data/trees';
import type { FamilyGraph, PersonKind } from '../family/family-graph';
import { birthOrderLabel } from '../family/labels';
import { ageAtDeath, deathAgeLabel, lifespanText } from '../people/person-display';
import { fieldLabel, fieldText, type TextFieldKey } from '../people/profile-fields';

/**
 * Phả ký: văn bản tường thuật từng Người theo Đời, khác Phả đồ (sơ đồ hình).
 * Suy thẳng từ dữ liệu đã có — không cần lưu thêm gì.
 */

/** `name`/`lifespan` tách riêng để web và PDF trình bày nổi bật; `lines` là mỗi nội dung một dòng. */
export type NarrativeItem = {
  personId: string;
  kind: PersonKind;
  gender: string | null;
  adopted: boolean;
  name: string;
  lifespan: string | null;
  /** Mỗi nội dung (nguyên quán, nơi ở, kết hôn…) một dòng, để dễ đọc ở web và PDF. */
  lines: string[];
};
export type NarrativeGeneration = { generation: number; male: number; female: number; total: number; items: NarrativeItem[] };

/** Giá trị người dùng gõ tự do: bỏ khoảng trắng và dấu câu cuối, để ghép câu không bị ".." hay dính vào câu sau. */
export const cleanFreeText = (value: string | null | undefined): string => (value ?? '').trim().replace(/[\s.,;:]+$/u, '');

/** Câu "Nhãn: giá trị." — nhãn luôn đứng riêng để các mục hồ sơ không dính chùm vào nhau; không có giá trị thì không có câu. */
const labelled = (label: string, value: string | null | undefined): string[] => {
  const text = cleanFreeText(value);
  return text ? [`${label}: ${text}.`] : [];
};

/** Các nhóm nội dung có thể bật/tắt trong tóm tắt từng Người của Phả ký, theo thứ tự hiện ở các nút chọn (nhóm mặc định đứng đầu). */
export const NARRATIVE_FIELDS = [
  { id: 'names', label: 'Tên gọi khác' },
  { id: 'parents', label: 'Cha mẹ' },
  { id: 'role', label: 'Chức vụ & vai vế' },
  { id: 'order', label: 'Thứ tự con' },
  { id: 'birthPlace', label: fieldLabel('birthPlace') },
  { id: 'hometown', label: fieldLabel('hometown') },
  { id: 'residence', label: fieldLabel('residence') },
  { id: 'marriage', label: 'Hôn nhân' },
  { id: 'occupation', label: fieldLabel('occupation') },
  { id: 'education', label: fieldLabel('education') },
  { id: 'death', label: 'Hưởng thọ' },
  { id: 'burial', label: 'An táng' },
  { id: 'worship', label: 'Thờ phụng' },
  { id: 'biography', label: 'Tiểu sử' },
] as const;
export type NarrativeField = (typeof NARRATIVE_FIELDS)[number]['id'];
export const ALL_NARRATIVE_FIELDS: readonly NarrativeField[] = NARRATIVE_FIELDS.map((field) => field.id);
/** Nhóm nội dung hiện sẵn trên trang Phả ký khi chưa chọn gì. */
export const DEFAULT_NARRATIVE_FIELDS: readonly NarrativeField[] = ['names', 'parents', 'role'];

const MARRIAGE_STATUS_NOTE: Record<string, string> = { ly_hon: ' (đã ly hôn)', goa: ' (góa)' };

/** Câu "Nhãn: giá trị." cho một trường hồ sơ (nhãn Phả ký lấy từ `profile-fields.ts`). */
const labelledField = (person: Person, key: TextFieldKey): string[] => labelled(fieldLabel(key, 'narrative'), fieldText(person, key));

const personNarrative = (
  graph: FamilyGraph<Person>,
  person: Person,
  fields: ReadonlySet<NarrativeField>,
): { lifespan: string | null; lines: string[] } => {
  const placement = graph.placement(person.id);
  const lifespan = lifespanText(person);
  const sentences: string[] = [];

  if (fields.has('names')) {
    const commonName = cleanFreeText(person.common_name);
    if (commonName) sentences.push(`Còn gọi là ${commonName}.`);
    sentences.push(...labelledField(person, 'courtesyName'));
  }

  if (placement.kind === 'thuy_to') {
    if (fields.has('parents')) sentences.push('Thuỷ tổ của dòng họ, người đời đầu tiên còn ghi lại được.');
  } else {
    if (fields.has('order') && person.birth_order !== null) sentences.push(`${birthOrderLabel(person.birth_order)}.`);
    if (fields.has('parents')) {
      const parents = graph.parentsOf(person.id).map((p) => p.person.full_name);
      if (parents.length > 0) sentences.push(`Con của ${parents.join(' và ')}.`);
    }
  }

  if (fields.has('birthPlace')) sentences.push(...labelledField(person, 'birthPlace'));
  if (fields.has('hometown')) sentences.push(...labelledField(person, 'hometown'));
  if (fields.has('residence') && cleanFreeText(person.residence) && (!fields.has('hometown') || cleanFreeText(person.residence) !== cleanFreeText(person.hometown))) {
    sentences.push(`Sinh sống tại ${cleanFreeText(person.residence)}.`);
  }

  if (fields.has('marriage')) {
    const spouses = graph.spousesOf(person.id).map((s) => `${s.person.full_name}${MARRIAGE_STATUS_NOTE[s.status] ?? ''}`);
    if (spouses.length > 0) sentences.push(`Kết hôn với ${spouses.join(', ')}.`);
  }

  if (fields.has('role')) {
    sentences.push(...labelledField(person, 'title'));
    sentences.push(...labelledField(person, 'roleNote'));
  }
  if (fields.has('occupation')) sentences.push(...labelledField(person, 'occupation'));
  if (fields.has('education')) sentences.push(...labelledField(person, 'education'));

  if (person.is_deceased) {
    if (fields.has('death')) {
      const age = ageAtDeath(person);
      sentences.push(age !== null ? `Mất, ${deathAgeLabel(age).toLowerCase()} ${age} tuổi.` : 'Đã mất.');
    }
    if (fields.has('burial') && cleanFreeText(person.burial_place)) sentences.push(`An táng tại ${cleanFreeText(person.burial_place)}.`);
    if (fields.has('worship') && cleanFreeText(person.worship_place)) sentences.push(`Thờ phụng tại ${cleanFreeText(person.worship_place)}.`);
  }

  if (fields.has('biography') && person.biography) sentences.push(person.biography.trim());

  return { lifespan: lifespan || null, lines: sentences };
};

/** Văn bản tường thuật theo Đời; `fields` là các nhóm nội dung được hiện (mặc định tất cả). */
export const buildNarrative = (graph: FamilyGraph<Person>, fields: Iterable<NarrativeField> = ALL_NARRATIVE_FIELDS): NarrativeGeneration[] => {
  const shown = new Set(fields);
  return graph.generations().map((group) => ({
    generation: group.generation,
    male: group.male,
    female: group.female,
    total: group.total,
    items: group.persons.map((person) => {
      const { lifespan, lines } = personNarrative(graph, person, shown);
      return { personId: person.id, kind: graph.placement(person.id).kind, gender: person.gender, adopted: graph.parentsOf(person.id).some((parent) => parent.kind === 'nuoi'), name: person.full_name, lifespan, lines };
    }),
  }));
};

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
 * Mỗi chi do một Người được đánh dấu "Lập chi mới" (founds_branch, ở bất kỳ Đời nào) lập ra; branchId tính sẵn
 * trong RPC tree_positions và chính là id của tổ chi. Chi xếp theo thứ bậc của tổ chi: Đời trên trước,
 * cùng Đời thì theo thứ tự trong danh sách Đời (con trưởng trước, con vợ cả trước con vợ hai).
 */
export const branchSummaries = (graph: FamilyGraph<Person>): BranchSummary[] => {
  const counts = new Map<string, number>();
  for (const person of graph.persons) {
    const branchId = graph.placement(person.id).branchId;
    if (branchId) counts.set(branchId, (counts.get(branchId) ?? 0) + 1);
  }
  const rank = new Map(graph.generations().flatMap((group) => group.persons).map((person, index) => [person.id, index]));
  return [...counts.entries()]
    .flatMap(([branchId, memberCount]) => {
      const founder = graph.person(branchId);
      return founder ? [{ branchId, founderName: founder.full_name, memberCount }] : [];
    })
    .sort((a, b) => (rank.get(a.branchId) ?? Infinity) - (rank.get(b.branchId) ?? Infinity));
};

/** Lời kết tự sinh: ghi rõ đây là bản suy từ dữ liệu điện tử, ngày xem, nhắn gửi con cháu bổ sung. */
export const closingNote = (today: { day: number; month: number; year: number }): string =>
  `Phả ký này lập tự động từ dữ liệu đã ghi trong Gia phả điện tử, tính đến ngày ${today.day}/${today.month}/${today.year}. ` +
  'Mong con cháu đời sau tiếp tục bổ sung những gì còn thiếu, và giữ gìn nếp nhà cùng việc giỗ chạp của dòng họ.';
