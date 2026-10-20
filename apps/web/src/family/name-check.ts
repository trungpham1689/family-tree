import type { Person } from '../data/trees';
import { lifespanText } from '../people/person-display';
import type { FamilyGraph, PersonKind } from './family-graph';

/**
 * Tra cứu trùng tên khi đặt tên cho bé: tên là chữ cuối của họ và tên, tên lót là chữ kế tên
 * (Phạm Đức Trung: tên Trung, tên lót Đức). Kiểm tra theo Đời của bé, xem ai trong gia phả đã dùng tên đó.
 */

export type BabyName = { family: string; middle: string | null; given: string };

/** Tách họ và tên; cần ít nhất hai chữ (họ + tên). Hai chữ thì không có tên lót. */
export const splitBabyName = (fullName: string): BabyName | null => {
  const words = fullName.trim().split(/\s+/u).filter(Boolean);
  if (words.length < 2) return null;
  return { family: words[0]!, middle: words.length >= 3 ? words.at(-2)! : null, given: words.at(-1)! };
};

/** Tên gọi của một Người: chữ cuối của họ và tên đầy đủ. */
export const givenNameOf = (fullName: string): string => fullName.trim().split(/\s+/u).filter(Boolean).at(-1) ?? '';

/** So khớp không phân biệt hoa thường nhưng giữ nguyên dấu: "Trung" khác "Trúng". */
const same = (a: string, b: string) => a.normalize('NFC').toLocaleLowerCase('vi') === b.normalize('NFC').toLocaleLowerCase('vi');

export type NameConflictReason =
  | { kind: 'same-generation-deceased'; text: string }
  | { kind: 'ancestor-given'; text: string }
  | { kind: 'ancestor-middle'; text: string };

export type NameConflict = {
  personId: string;
  fullName: string;
  generation: number;
  personKind: PersonKind;
  deceased: boolean;
  lifespan: string | null;
  reasons: NameConflictReason[];
};

export type NameCheckResult =
  | { ok: false; error: string }
  | { ok: true; baby: BabyName; generation: number; conflicts: NameConflict[] };

/**
 * Những người trong gia phả làm bé không nên mang tên này, kèm lý do. Xét các Đời từ 1 tới Đời của bé:
 * - cùng Đời, đã mất, trùng tên với tên của bé;
 * - Đời trên, tên trùng tên của bé;
 * - Đời trên, tên trùng tên lót của bé.
 * Người chưa nối vào cây (chưa có Đời) bị bỏ qua. `includeSpouses` = false thì bỏ Dâu/Rể.
 */
export const checkBabyName = (
  graph: FamilyGraph<Person>,
  fullName: string,
  generation: number,
  options: { includeSpouses?: boolean } = {},
): NameCheckResult => {
  const baby = splitBabyName(fullName);
  if (!baby) return { ok: false, error: 'Hãy nhập họ và tên, ít nhất hai chữ (ví dụ: Phạm Đức Trung).' };
  if (!Number.isInteger(generation) || generation < 1) return { ok: false, error: 'Số Đời phải là số nguyên từ 1 trở lên.' };
  const includeSpouses = options.includeSpouses ?? true;

  const conflicts: NameConflict[] = [];
  for (const person of graph.persons) {
    const { generation: personGeneration, kind } = graph.placement(person.id);
    if (personGeneration === null || personGeneration > generation) continue;
    if (!includeSpouses && kind === 'dau_re') continue;
    const given = givenNameOf(person.full_name);
    if (!given) continue;

    const reasons: NameConflictReason[] = [];
    if (personGeneration === generation) {
      if (person.is_deceased && same(given, baby.given)) {
        reasons.push({ kind: 'same-generation-deceased', text: `Cùng Đời ${generation}, đã mất, trùng tên "${given}" với tên của Bé.` });
      }
    } else {
      if (same(given, baby.given)) {
        reasons.push({ kind: 'ancestor-given', text: `Đời ${personGeneration} (đời trên), tên "${given}" trùng với tên của Bé.` });
      }
      if (baby.middle && same(given, baby.middle)) {
        reasons.push({ kind: 'ancestor-middle', text: `Đời ${personGeneration} (đời trên), tên "${given}" trùng với tên lót "${baby.middle}" của Bé.` });
      }
    }
    if (reasons.length === 0) continue;
    conflicts.push({
      personId: person.id,
      fullName: person.full_name,
      generation: personGeneration,
      personKind: kind,
      deceased: person.is_deceased,
      lifespan: lifespanText(person) || null,
      reasons,
    });
  }
  // Đời gần bé trước (cùng Đời, rồi cha, ông…), cùng Đời thì theo tên.
  conflicts.sort((a, b) => b.generation - a.generation || a.fullName.localeCompare(b.fullName, 'vi'));
  return { ok: true, baby, generation, conflicts };
};

/** Đời của bé: Đời của cha/mẹ (người nào có Đời; nếu cả hai thì lấy Đời lớn hơn) cộng một; `null` khi cha/mẹ chưa nối vào cây. */
export const babyGeneration = (graph: FamilyGraph<Person>, parentIds: readonly (string | null)[]): number | null => {
  const generations = parentIds.flatMap((id) => {
    const generation = id ? graph.placement(id).generation : null;
    return generation === null ? [] : [generation];
  });
  return generations.length > 0 ? Math.max(...generations) + 1 : null;
};
