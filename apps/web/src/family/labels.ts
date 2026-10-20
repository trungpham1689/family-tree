import type { NodeMarriage } from '@gia-pha/tree-layout';
import type { ParentLinkKind, PersonKind, UnionStatus } from './family-graph';

/** Nhãn loại Người: Dâu hay Rể tuỳ giới tính. */
export const kindLabel = (kind: PersonKind, gender: string | null): string => {
  switch (kind) {
    case 'thuy_to':
      return 'Thuỷ tổ';
    case 'dinh':
      return 'Đinh';
    case 'dau_re':
      return gender === 'nam' ? 'Rể' : gender === 'nu' ? 'Dâu' : 'Dâu/Rể';
    case 'chua_noi':
      return 'Chưa nối vào cây';
  }
};

export const LINK_KIND_LABELS: Record<ParentLinkKind, string> = { ruot: 'Ruột', nuoi: 'Nuôi' };

export const UNION_STATUS_LABELS: Record<UnionStatus, string> = { con: 'Đang chung sống', ly_hon: 'Đã ly hôn', goa: 'Đã mất' };

/** "Vợ cả", "Vợ hai", "Chồng"… theo thứ tự hôn phối và giới tính của người kia. */
export const spouseLabel = (gender: string | null, order: number): string => {
  const role = gender === 'nam' ? 'Chồng' : gender === 'nu' ? 'Vợ' : 'Vợ/chồng';
  if (order <= 1) return role === 'Vợ' ? 'Vợ cả' : role;
  const ordinals = ['', '', 'hai', 'ba', 'tư', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười'];
  return `${role} ${ordinals[order] ?? `thứ ${order}`}`;
};

/** Dạng ngắn của tình trạng hôn phối, vừa trong ô Dâu/Rể. */
export const UNION_STATUS_SHORT: Record<UnionStatus, string> = { con: 'sống chung', ly_hon: 'ly hôn', goa: 'goá' };

const spouseRole = (gender: string | null): string => (gender === 'nam' ? 'chồng' : gender === 'nu' ? 'vợ' : 'vợ/chồng');

/**
 * Nhãn hôn phối trong ô Dâu/Rể: dòng 1 "Chồng hai · goá" (thứ tự chỉ ghi khi người trong họ có từ 2 vợ/chồng), dòng 2
 * "cũng là chồng của …" khi Dâu/Rể có ô ở nhiều người trong họ. `null` với cây một vợ một chồng còn chung sống: không ghi gì.
 */
export const marriageNote = (
  marriage: NodeMarriage,
  gender: string | null,
  nameOf: (personId: string) => string | undefined,
): { label: string | null; also: string | null } | null => {
  const multi = marriage.spouseCount >= 2;
  const status = marriage.status in UNION_STATUS_SHORT ? (marriage.status as UnionStatus) : 'con';
  const label =
    multi || status !== 'con'
      ? `${multi ? spouseLabel(gender, marriage.order) : capitalize(spouseRole(gender))} · ${UNION_STATUS_SHORT[status]}`
      : null;
  const others = marriage.alsoSpouseOf.map((id) => nameOf(id)).filter((name): name is string => Boolean(name));
  const also = others.length > 0 ? `cũng là ${spouseRole(gender)} của ${others.join(', ')}` : null;
  return label || also ? { label, also } : null;
};

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** "Con trưởng", "Con thứ hai"… theo Thứ tự con. */
export const birthOrderLabel = (order: number | null): string => {
  if (order === null) return '';
  if (order === 1) return 'Con trưởng';
  const ordinals = ['', '', 'hai', 'ba', 'tư', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười'];
  return `Con thứ ${ordinals[order] ?? order}`;
};

/** "1 vợ", "2 chồng", "1 vợ, 1 chồng"; người chưa rõ giới tính tính là "vợ/chồng". */
export const spouseCountText = (genders: readonly (string | null)[]): string => {
  const count = (pick: (gender: string | null) => boolean) => genders.filter(pick).length;
  const parts: [number, string][] = [
    [count((gender) => gender === 'nu'), 'vợ'],
    [count((gender) => gender === 'nam'), 'chồng'],
    [count((gender) => gender !== 'nu' && gender !== 'nam'), 'vợ/chồng'],
  ];
  return parts.filter(([n]) => n > 0).map(([n, word]) => `${n} ${word}`).join(', ');
};
