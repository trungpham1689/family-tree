import type { Orientation } from '@gia-pha/tree-layout';
import { outsideLabel } from '../family/outside-generations';
import type { RevealPlan } from './tree-search';

const ORIENTATION_KEY = 'gia-pha:huong-cay';

/** Hướng Cây đã nhớ trên máy này; không đọc được (chế độ riêng tư…) thì mặc định trên → dưới. */
export const readOrientation = (storage: Pick<Storage, 'getItem'> | null = safeStorage()): Orientation => {
  try {
    return storage?.getItem(ORIENTATION_KEY) === 'left-right' ? 'left-right' : 'top-down';
  } catch {
    return 'top-down';
  }
};

export const saveOrientation = (orientation: Orientation, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void => {
  try {
    storage?.setItem(ORIENTATION_KEY, orientation);
  } catch {
    // Không lưu được thì chỉ mất ghi nhớ, Cây vẫn đổi hướng bình thường.
  }
};

const safeStorage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

export type RevealOutcome = {
  /** Câu báo cho người xem (hoặc null). */
  notice: string | null;
  /** Tập thu gọn mới; null nếu không đổi (người đó chưa nối vào cây). */
  collapsed: Set<string> | null;
  /** Số đời Cháu ngoại cần đặt (ghi đè tạm); null nếu giữ nguyên. */
  outsideOverride: number | null;
  /** Có chọn / cuộn tới người đó không. */
  focus: boolean;
};

/** Kết quả của "tìm và hiện một Người": biến kế hoạch `planReveal` thành các thay đổi trạng thái và câu báo. */
export const describeReveal = (plan: RevealPlan | null, personName: string | undefined, currentOutside: number): RevealOutcome => {
  if (!plan) {
    return { notice: `${personName ?? 'Người này'} chưa nối vào cây nên không hiện trên Cây.`, collapsed: null, outsideOverride: null, focus: false };
  }
  return {
    notice: plan.outsideGenerations > currentOutside ? `Đã chuyển sang ${outsideLabel(plan.outsideGenerations).toLowerCase()} để hiện người này.` : null,
    collapsed: plan.collapsed,
    outsideOverride: plan.outsideGenerations !== currentOutside ? plan.outsideGenerations : null,
    focus: true,
  };
};
