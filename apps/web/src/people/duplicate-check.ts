/** So khớp tên không phân biệt hoa thường, dấu, khoảng trắng thừa — phát hiện nhập trùng Người. */

export type DuplicateCandidate = { id: string; full_name: string; birth_year: number | null };

export const normalizeName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');

/** Người đã có trong gia phả trùng tên (sau khi bỏ dấu) với tên đang nhập. */
export const findDuplicates = (name: string, candidates: readonly DuplicateCandidate[]): DuplicateCandidate[] => {
  const normalized = normalizeName(name);
  if (!normalized) return [];
  return candidates.filter((candidate) => normalizeName(candidate.full_name) === normalized);
};

/** Hai người có thể là một nếu năm sinh khớp hoặc một bên chưa biết năm sinh. */
const compatible = (a: DuplicateCandidate, b: DuplicateCandidate) => a.birth_year === null || b.birth_year === null || a.birth_year === b.birth_year;

/**
 * Các nhóm Người nghi trùng nhau: cùng tên (bỏ dấu, hoa thường) và năm sinh không mâu thuẫn. Mỗi nhóm ít nhất 2 người;
 * hai người cùng tên nhưng khác năm sinh được coi là hai người khác nhau.
 */
export const duplicateGroups = <P extends DuplicateCandidate>(persons: readonly P[]): P[][] => {
  const buckets = new Map<string, P[][]>();
  for (const person of persons) {
    const key = normalizeName(person.full_name);
    if (!key) continue;
    const clusters = buckets.get(key) ?? [];
    const cluster = clusters.find((members) => members.every((member) => compatible(member, person)));
    if (cluster) cluster.push(person);
    else clusters.push([person]);
    buckets.set(key, clusters);
  }
  return [...buckets.values()].flat().filter((cluster) => cluster.length >= 2);
};
