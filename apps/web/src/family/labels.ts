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

/** "Con trưởng", "Con thứ hai"… theo Thứ tự con. */
export const birthOrderLabel = (order: number | null): string => {
  if (order === null) return '';
  if (order === 1) return 'Con trưởng';
  const ordinals = ['', '', 'hai', 'ba', 'tư', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười'];
  return `Con thứ ${ordinals[order] ?? order}`;
};
