import type { CalendarSource } from '@gia-pha/reminders';
import { useMemo, useState } from 'react';
import { todayInVietnam } from '../calendar/month-grid';
import { Button } from '../ui/Button';
import { ErrorBanner, TextField } from '../ui/fields';
import { MAX_SEARCH_RESULTS, searchEventOccurrences, toIsoDate } from './event-search';

const formatDate = (iso: string) => iso.split('-').reverse().join('/');

/** Xem lại sự kiện cũ và tìm sự kiện theo tên trong một khoảng thời gian: mỗi lần diễn ra (kể cả sự kiện lặp) một dòng. */
export const EventSearchPanel = ({ source }: { source: CalendarSource | undefined }) => {
  const today = todayInVietnam();
  const todayIso = toIsoDate(today);
  const [from, setFrom] = useState(toIsoDate({ ...today, year: today.year - 1 }));
  const [to, setTo] = useState(todayIso);
  const [query, setQuery] = useState('');

  const result = useMemo(() => (source ? searchEventOccurrences(source, { from, to, query }) : null), [source, from, to, query]);
  const preset = (fromDate: string, toDate: string) => {
    setFrom(fromDate);
    setTo(toDate);
  };

  return (
    <section className="mt-8 rounded-xl border border-line bg-surface px-4 py-3" aria-labelledby="tim-su-kien">
      <h2 id="tim-su-kien" className="font-serif text-xl font-bold">
        Xem lại và tìm sự kiện
      </h2>
      <p className="mt-1 text-ink-muted">Chọn khoảng thời gian (tối đa 20 năm) để xem sự kiện đã qua hay sắp tới; gõ tên để lọc.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <TextField label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <TextField label="Đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <TextField label="Tên sự kiện" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => preset(toIsoDate({ ...today, year: today.year - 1 }), todayIso)}>
          12 tháng qua
        </Button>
        <Button variant="secondary" onClick={() => preset(`${today.year}-01-01`, `${today.year}-12-31`)}>
          Năm nay
        </Button>
        <Button variant="secondary" onClick={() => preset(`${today.year - 1}-01-01`, `${today.year - 1}-12-31`)}>
          Năm ngoái
        </Button>
      </div>

      {result && !result.ok && <ErrorBanner>{result.error}</ErrorBanner>}
      {result?.ok && (
        <div className="mt-4" aria-live="polite">
          {result.occurrences.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-ink-muted">Không có sự kiện nào trong khoảng này.</p>
          ) : (
            <>
              <p className="text-sm text-ink-muted">
                {result.truncated ? `Hiện ${MAX_SEARCH_RESULTS} lần đầu tiên; hãy thu hẹp khoảng thời gian hoặc gõ tên để lọc.` : `${result.occurrences.length} lần diễn ra`}
              </p>
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line">
                {result.occurrences.map((occurrence, index) => {
                  const iso = toIsoDate(occurrence.date);
                  return (
                    <li key={`${occurrence.eventId}-${iso}-${index}`} className="grid grid-cols-[6.5rem_1fr] gap-x-3 px-4 py-2">
                      <span className="font-semibold tabular-nums">{formatDate(iso)}</span>
                      <span>
                        <a href={`#${occurrence.eventId}`} className="font-semibold hover:text-son hover:underline">
                          {occurrence.title}
                        </a>
                        {occurrence.detail && <span className="block text-sm text-ink-muted">{occurrence.detail}</span>}
                      </span>
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
