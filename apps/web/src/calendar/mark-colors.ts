import type { OccurrenceKind } from '@gia-pha/reminders';

export const MARK_COLORS: Record<OccurrenceKind, string> = {
  gio: 'bg-son',
  sinh_nhat: 'bg-la',
  cuoi: 'bg-kim',
  su_kien: 'bg-tram',
};

export const MARK_LABELS: Record<OccurrenceKind, string> = {
  gio: 'giỗ',
  sinh_nhat: 'sinh nhật',
  cuoi: 'kỷ niệm cưới',
  su_kien: 'sự kiện',
};
