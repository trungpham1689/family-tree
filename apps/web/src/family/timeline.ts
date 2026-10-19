import { VN_HISTORY } from './vn-history';

export type TimelineKind = 'sinh' | 'mat' | 'cuoi' | 'lich_su';

export type TimelineEntry = {
  year: number;
  kind: TimelineKind;
  text: string;
  /** Chi tiết phụ: "hưởng thọ 80 tuổi", "khoảng"… */
  detail?: string;
  /** Người để bấm vào xem hồ sơ (cuộc hôn phối thì là một trong hai người). */
  personId?: string;
};

type TimelinePerson = {
  id: string;
  full_name: string;
  birth_year: number | null;
  birth_approx?: boolean;
  death_year: number | null;
  death_approx?: boolean;
};
type TimelineUnion = { partner_a: string; partner_b: string; status: string; marriage_year?: number | null };

const KIND_ORDER: Record<TimelineKind, number> = { sinh: 0, cuoi: 1, mat: 2, lich_su: 3 };

/**
 * Các mốc sinh, mất, kết hôn đã biết năm, xếp theo năm (cùng năm: sinh → cưới → mất). Hưởng thọ tính theo tuổi mụ
 * (năm mất − năm sinh + 1) như Phả ký. Bật `withHistory` thì xen thêm mốc lịch sử Việt Nam trong khoảng năm của gia đình.
 */
export const buildTimeline = (
  persons: readonly TimelinePerson[],
  unions: readonly TimelineUnion[],
  withHistory: boolean,
): TimelineEntry[] => {
  const byId = new Map(persons.map((person) => [person.id, person]));
  const entries: TimelineEntry[] = [];

  for (const person of persons) {
    if (person.birth_year !== null) {
      entries.push({ year: person.birth_year, kind: 'sinh', text: `${person.full_name} chào đời`, personId: person.id, ...(person.birth_approx ? { detail: 'khoảng' } : {}) });
    }
    if (person.death_year !== null) {
      const age = person.birth_year !== null ? person.death_year - person.birth_year + 1 : null;
      const detail = [person.death_approx ? 'khoảng' : null, age !== null && age > 0 ? `hưởng thọ ${age} tuổi` : null].filter(Boolean).join(' · ');
      entries.push({ year: person.death_year, kind: 'mat', text: `${person.full_name} qua đời`, personId: person.id, ...(detail ? { detail } : {}) });
    }
  }
  for (const union of unions) {
    const a = byId.get(union.partner_a);
    const b = byId.get(union.partner_b);
    if (union.marriage_year == null || !a || !b) continue;
    entries.push({ year: union.marriage_year, kind: 'cuoi', text: `${a.full_name} & ${b.full_name} kết hôn`, personId: a.id });
  }

  if (withHistory && entries.length > 0) {
    const first = Math.min(...entries.map((entry) => entry.year));
    const last = Math.max(...entries.map((entry) => entry.year));
    for (const item of VN_HISTORY) {
      if (item.year >= first && item.year <= last) entries.push({ year: item.year, kind: 'lich_su', text: item.text });
    }
  }

  return entries.sort((a, b) => a.year - b.year || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.text.localeCompare(b.text, 'vi'));
};
