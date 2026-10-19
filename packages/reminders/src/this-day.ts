import type { SolarDate } from '@gia-pha/lunar';
import type { CalendarSource } from './occurrences.ts';

/** Một mốc "Ngày này năm xưa": người đã mất chào đời hoặc qua đời đúng ngày-tháng này của một năm trước. */
export type HistoryItem = {
  kind: 'sinh' | 'mat';
  year: number;
  yearsAgo: number;
  personId: string;
  treeId: string;
  treeName: string;
  text: string;
};

const parseIso = (iso: string | null | undefined): SolarDate | null => {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
};

/**
 * Ngày sinh / ngày mất (dương, đủ ngày) của người đã mất trùng ngày-tháng hôm nay. Sinh nhật người còn sống
 * và Kỷ niệm cưới đã có trong nhắc nhở thường nên không lặp lại ở đây. Mới nhất trước.
 */
export const onThisDay = (source: CalendarSource, today: SolarDate): HistoryItem[] => {
  const treeName = new Map(source.trees.map((tree) => [tree.id, tree.name]));
  const items: HistoryItem[] = [];
  for (const person of source.persons) {
    if (!person.is_deceased) continue;
    const base = { personId: person.id, treeId: person.tree_id, treeName: treeName.get(person.tree_id) ?? '' };
    for (const [kind, iso, verb] of [
      ['sinh', person.birth_solar_date, 'chào đời'],
      ['mat', person.death_solar_date, 'qua đời'],
    ] as const) {
      const date = parseIso(iso);
      if (date && date.month === today.month && date.day === today.day && date.year < today.year) {
        items.push({ ...base, kind, year: date.year, yearsAgo: today.year - date.year, text: `${person.full_name} ${verb}` });
      }
    }
  }
  return items.sort((a, b) => b.year - a.year);
};
