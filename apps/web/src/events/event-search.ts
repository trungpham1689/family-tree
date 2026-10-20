import { julianDay, type SolarDate } from '@gia-pha/lunar';
import { occurrencesBetween, type CalendarSource, type Occurrence, type OccurrenceKind } from '@gia-pha/reminders';
import { normalizeName } from '../tree/tree-search';

/** Khoảng tìm tối đa (năm): đủ xem lại cả đời người mà vẫn nhanh với sự kiện âm lịch hằng tháng. */
export const MAX_SEARCH_YEARS = 20;
/** Số lần diễn ra tối đa hiện ra một lần; vượt thì báo để thu hẹp khoảng/từ khoá. */
export const MAX_SEARCH_RESULTS = 300;

export const toIsoDate = ({ year, month, day }: SolarDate): string =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const parseIsoDate = (iso: string): SolarDate | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const real = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return real.getUTCFullYear() === date.year && real.getUTCMonth() === date.month - 1 && real.getUTCDate() === date.day ? date : null;
};

/** Lọc theo loại: tất cả, hoặc một trong giỗ, sinh nhật, kỷ niệm cưới, sự kiện. */
export type KindFilter = 'all' | OccurrenceKind;

export const KIND_FILTER_LABELS: Record<KindFilter, string> = {
  all: 'Tất cả',
  su_kien: 'Sự kiện',
  gio: 'Giỗ',
  sinh_nhat: 'Sinh nhật',
  cuoi: 'Kỷ niệm cưới',
};

export type EventSearch = { ok: true; occurrences: Occurrence[]; truncated: boolean } | { ok: false; error: string };

/**
 * Các lần diễn ra của giỗ, sinh nhật, kỷ niệm cưới và Sự kiện trong khoảng [from, to] (ngày YYYY-MM-DD, gồm cả hai đầu),
 * lọc theo loại và từ khoá trong tên (không phân biệt hoa thường, dấu), xếp theo ngày. Sự kiện lặp tính ra từng lần.
 */
export const searchEventOccurrences = (
  source: CalendarSource,
  input: { from: string; to: string; query: string; kind?: KindFilter },
): EventSearch => {
  const from = parseIsoDate(input.from);
  const to = parseIsoDate(input.to);
  if (!from || !to) return { ok: false, error: 'Hãy chọn ngày bắt đầu và ngày kết thúc.' };
  if (julianDay(from) > julianDay(to)) return { ok: false, error: 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.' };
  if (to.year - from.year > MAX_SEARCH_YEARS) return { ok: false, error: `Chỉ tìm trong khoảng tối đa ${MAX_SEARCH_YEARS} năm.` };

  const needle = normalizeName(input.query);
  const kind = input.kind ?? 'all';
  const found = occurrencesBetween(source, from, to).filter(
    (occurrence) => (kind === 'all' || occurrence.kind === kind) && (needle === '' || normalizeName(occurrence.title).includes(needle)),
  );
  return { ok: true, occurrences: found.slice(0, MAX_SEARCH_RESULTS), truncated: found.length > MAX_SEARCH_RESULTS };
};
