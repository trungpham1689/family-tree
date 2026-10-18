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
