/** Hồ sơ còn thiếu: giúp Biên tập viên biết nên bổ sung gì tiếp. */

export type IncompleteReason = 'gioi_tinh' | 'nam_sinh' | 'nam_mat';

export const REASON_LABELS: Record<IncompleteReason, string> = {
  gioi_tinh: 'Chưa rõ giới tính',
  nam_sinh: 'Chưa rõ năm sinh',
  nam_mat: 'Đã mất nhưng chưa rõ năm mất',
};

type IncompletePerson = { gender: string | null; birth_year: number | null; death_year: number | null; is_deceased: boolean };

export type IncompleteEntry<P> = { person: P; reasons: IncompleteReason[] };

export const findIncomplete = <P extends IncompletePerson>(persons: readonly P[]): IncompleteEntry<P>[] =>
  persons.flatMap((person) => {
    const reasons: IncompleteReason[] = [];
    if (person.gender === null) reasons.push('gioi_tinh');
    if (person.birth_year === null) reasons.push('nam_sinh');
    if (person.is_deceased && person.death_year === null) reasons.push('nam_mat');
    return reasons.length > 0 ? [{ person, reasons }] : [];
  });
