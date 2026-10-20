/**
 * Nhớ "đang làm việc ở đâu" trong một gia phả (theo từng tab, mất khi đóng tab) để sau khi mở hồ sơ một Người, sửa xong rồi quay lại,
 * người dùng vẫn ở đúng Đời / đúng chỗ trên Cây thay vì bị đưa về đầu.
 */

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const safeStore = (): Store | null => {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
};

const read = <T extends object>(key: string, store: Store | null): T => {
  try {
    const raw = store?.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed !== null && typeof parsed === 'object' ? (parsed as T) : ({} as T);
  } catch {
    return {} as T;
  }
};

const write = <T extends object>(key: string, patch: Partial<T>, store: Store | null): void => {
  try {
    store?.setItem(key, JSON.stringify({ ...read<T>(key, store), ...patch }));
  } catch {
    // Không lưu được (chế độ riêng tư, đầy bộ nhớ…) thì chỉ mất ghi nhớ.
  }
};

/** Trang Tổng quan (danh sách các Đời) và nơi người dùng vừa rời đi. */
export type OverviewPosition = {
  generation?: number | undefined;
  /** Người vừa mở hồ sơ: quay lại thì cuộn tới thẻ của người này. */
  personId?: string | undefined;
  /** Mở hồ sơ từ đâu, để nút "←" trên hồ sơ đưa về đúng nơi. */
  view?: 'cay' | 'tong-quan' | undefined;
};

export const readOverviewPosition = (treeId: string, store: Store | null = safeStore()): OverviewPosition =>
  read<OverviewPosition>(`gia-pha:vi-tri:${treeId}`, store);

export const rememberOverviewPosition = (treeId: string, patch: OverviewPosition, store: Store | null = safeStore()): void =>
  write<OverviewPosition>(`gia-pha:vi-tri:${treeId}`, patch, store);

/** Trạng thái Cây (theo gốc Cây): nhánh đã thu gọn, số đời Cháu ngoại đổi tạm, người vừa mở. */
export type CanvasPosition = {
  collapsed?: string[] | undefined;
  outside?: number | null | undefined;
  personId?: string | undefined;
};

export const readCanvasPosition = (rootId: string, store: Store | null = safeStore()): CanvasPosition =>
  read<CanvasPosition>(`gia-pha:cay-vi-tri:${rootId}`, store);

export const rememberCanvasPosition = (rootId: string, patch: CanvasPosition, store: Store | null = safeStore()): void =>
  write<CanvasPosition>(`gia-pha:cay-vi-tri:${rootId}`, patch, store);
