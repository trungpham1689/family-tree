import type { OccurrenceKind } from '@gia-pha/reminders';

export const MARK_COLORS: Record<OccurrenceKind, string> = {
  gio: 'bg-son',
  sinh_nhat: 'bg-la',
  cuoi: 'bg-kim',
  su_kien: 'bg-tram',
};

/** Viền cùng màu với MARK_COLORS, cho chấm rỗng của sự kiện đã qua. */
const MARK_RINGS: Record<OccurrenceKind, string> = {
  gio: 'border-son',
  sinh_nhat: 'border-la',
  cuoi: 'border-kim',
  su_kien: 'border-tram',
};

export const MARK_LABELS: Record<OccurrenceKind, string> = {
  gio: 'giỗ',
  sinh_nhat: 'sinh nhật',
  cuoi: 'kỷ niệm cưới',
  su_kien: 'sự kiện',
};

/** Chấm loại sự kiện: đặc nếu từ hôm nay trở đi, rỗng nếu đã qua. `size` là class kích thước, vd "size-2.5". */
export const markDotClass = (kind: OccurrenceKind, hollow: boolean, size = 'size-2.5'): string =>
  `${size} shrink-0 rounded-full ${hollow ? `border-2 ${MARK_RINGS[kind]}` : MARK_COLORS[kind]}`;
