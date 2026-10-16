import type { OccurrenceKind } from './occurrences';

export const MARK_COLORS: Record<OccurrenceKind, string> = {
  gio: 'bg-son',
  sinh_nhat: 'bg-la',
  su_kien: 'bg-tram',
};

export const MARK_LABELS: Record<OccurrenceKind, string> = {
  gio: 'giỗ',
  sinh_nhat: 'sinh nhật',
  su_kien: 'sự kiện',
};
