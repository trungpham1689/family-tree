import { ageAtDeath, currentAge } from '../people/person-display';

type StatPerson = {
  id: string;
  full_name: string;
  birth_year: number | null;
  death_year: number | null;
  is_deceased: boolean;
};
type StatLink = { child_id: string; parent_id: string; kind: string };

export type FunStats = {
  /** Tuổi thọ trung bình của người đã mất (biết cả năm sinh và năm mất, tuổi mụ). */
  averageLifespan: number | null;
  longestLived: { person: StatPerson; age: number } | null;
  oldestLiving: { person: StatPerson; age: number } | null;
  /** Số con ruột trung bình của những người có con. */
  averageChildren: number | null;
  topSurnames: { name: string; count: number }[];
  topGivenNames: { name: string; count: number }[];
};

const TOP = 3;

const top = (words: readonly string[]) => {
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'))
    .slice(0, TOP);
};

/** Vài con số vui từ dữ liệu sẵn có; thiếu dữ liệu thì để null/rỗng thay vì đoán. */
export const computeFunStats = (persons: readonly StatPerson[], parentLinks: readonly StatLink[], todayYear: number): FunStats => {
  const lifespans = persons.flatMap((person) => {
    const age = ageAtDeath(person);
    return age !== null && age > 0 ? [{ person, age }] : [];
  });
  const living = persons.flatMap((person) => {
    const age = currentAge(person, todayYear);
    return age !== null && age > 0 ? [{ person, age }] : [];
  });
  const childrenPerParent = new Map<string, number>();
  for (const link of parentLinks) if (link.kind === 'ruot') childrenPerParent.set(link.parent_id, (childrenPerParent.get(link.parent_id) ?? 0) + 1);
  const names = persons.map((person) => person.full_name.trim().split(/\s+/)).filter((words) => words.length >= 2);

  const byAge = (a: { age: number }, b: { age: number }) => b.age - a.age;
  return {
    averageLifespan: lifespans.length > 0 ? lifespans.reduce((sum, item) => sum + item.age, 0) / lifespans.length : null,
    longestLived: [...lifespans].sort(byAge)[0] ?? null,
    oldestLiving: [...living].sort(byAge)[0] ?? null,
    averageChildren: childrenPerParent.size > 0 ? [...childrenPerParent.values()].reduce((a, b) => a + b, 0) / childrenPerParent.size : null,
    topSurnames: top(names.map((words) => words[0]!)),
    topGivenNames: top(names.map((words) => words[words.length - 1]!)),
  };
};
