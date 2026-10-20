import { fromJulianDay, julianDay } from '@gia-pha/lunar';
import type { CalendarSource, Occurrence } from '@gia-pha/reminders';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { MARK_COLORS } from '../calendar/mark-colors';
import { todayInVietnam, weekdayName } from '../calendar/month-grid';
import { Button } from '../ui/Button';
import { ErrorBanner, Select, TextField } from '../ui/fields';
import { KIND_FILTER_LABELS, MAX_SEARCH_RESULTS, searchEventOccurrences, toIsoDate, type KindFilter } from './event-search';

export type EventSearchInitial = { from: string; to: string; query: string };

const formatDate = (iso: string) => iso.split('-').reverse().join('/');
const DEFAULT_DAYS = 30;

/**
 * Bộ lọc và danh sách duy nhất của trang Sự kiện: khoảng thời gian (mặc định 30 ngày tới), loại (giỗ, sinh nhật, kỷ niệm cưới,
 * sự kiện) và tên. Mỗi lần diễn ra (kể cả sự kiện lặp) một dòng; `extra` và `actions` thêm chi tiết / nút cho từng dòng.
 */
export const EventSearchPanel = ({
  source,
  loading = false,
  error = null,
  initial,
  extra,
  actions,
}: {
  source: CalendarSource | undefined;
  /** Đang tải dữ liệu lịch. */
  loading?: boolean;
  /** Lỗi tải dữ liệu lịch (hiện thay cho danh sách). */
  error?: string | null;
  initial?: EventSearchInitial | undefined;
  extra?: (occurrence: Occurrence) => ReactNode;
  actions?: (occurrence: Occurrence) => ReactNode;
}) => {
  const today = todayInVietnam();
  const todayIso = toIsoDate(today);
  const inDays = (days: number) => toIsoDate(fromJulianDay(julianDay(today) + days));
  const [from, setFrom] = useState(initial?.from ?? todayIso);
  const [to, setTo] = useState(initial?.to ?? inDays(DEFAULT_DAYS));
  const [query, setQuery] = useState(initial?.query ?? '');
  const [kind, setKind] = useState<KindFilter>('all');

  const result = useMemo(() => (source ? searchEventOccurrences(source, { from, to, query, kind }) : null), [source, from, to, query, kind]);
  const preset = (fromDate: string, toDate: string) => {
    setFrom(fromDate);
    setTo(toDate);
  };

  return (
    <section className="mt-6" aria-label="Tìm sự kiện">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <TextField label="Đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <TextField label="Tên" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        <label className="block">
          <span className="mb-1 block font-medium">Loại</span>
          <Select className="w-full" value={kind} onChange={(event) => setKind(event.target.value as KindFilter)}>
            {(Object.keys(KIND_FILTER_LABELS) as KindFilter[]).map((key) => (
              <option key={key} value={key}>
                {KIND_FILTER_LABELS[key]}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => preset(todayIso, inDays(DEFAULT_DAYS))}>
          30 ngày tới
        </Button>
        <Button variant="secondary" onClick={() => preset(inDays(-DEFAULT_DAYS), todayIso)}>
          30 ngày qua
        </Button>
        <Button variant="secondary" onClick={() => preset(`${today.year}-01-01`, `${today.year}-12-31`)}>
          Năm nay
        </Button>
        <Button variant="secondary" onClick={() => preset(`${today.year - 1}-01-01`, `${today.year - 1}-12-31`)}>
          Năm ngoái
        </Button>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}
      {!error && !result && loading && <p className="mt-4 text-ink-muted">Đang tải…</p>}
      {result && !result.ok && <ErrorBanner>{result.error}</ErrorBanner>}
      {result?.ok && (
        <div className="mt-4" aria-live="polite">
          {result.occurrences.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-ink-muted">
              Không có sự kiện nào trong khoảng thời gian này.
            </p>
          ) : (
            <>
              <p className="text-sm text-ink-muted">
                {result.truncated ? `Hiện ${MAX_SEARCH_RESULTS} dòng đầu tiên; hãy thu hẹp khoảng thời gian hoặc lọc theo loại, tên.` : `${result.occurrences.length} kết quả`}
              </p>
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {result.occurrences.map((occurrence, index) => {
                  const iso = toIsoDate(occurrence.date);
                  const daysAway = julianDay(occurrence.date) - julianDay(today);
                  const actionsNode = actions?.(occurrence);
                  return (
                    <li key={`${occurrence.kind}-${occurrence.personId ?? occurrence.eventId}-${iso}-${index}`} className={`px-4 py-3 ${daysAway < 0 ? 'bg-paper/60' : ''}`}>
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <div className="flex min-w-0 flex-1 gap-3">
                          <span aria-hidden="true" className={`mt-2 size-2.5 shrink-0 rounded-full ${MARK_COLORS[occurrence.kind]}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-son">
                              {weekdayName(occurrence.date)}, {formatDate(iso)}
                              {daysAway === 0 ? ' · Hôm nay' : daysAway < 0 ? ' · Đã qua' : ''}
                            </p>
                            {occurrence.personId ? (
                              <Link to={`/gia-pha/${occurrence.treeId}/nguoi/${occurrence.personId}`} className="block font-semibold hover:text-son hover:underline">
                                {occurrence.title}
                              </Link>
                            ) : (
                              <p className="font-semibold">{occurrence.title}</p>
                            )}
                            {occurrence.detail && <p className="text-sm text-ink-muted">{occurrence.detail}</p>}
                            {extra?.(occurrence)}
                          </div>
                        </div>
                        {actionsNode}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
};
