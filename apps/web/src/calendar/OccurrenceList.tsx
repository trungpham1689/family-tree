import type { SolarDate } from '@gia-pha/lunar';
import type { Occurrence } from '@gia-pha/reminders';
import { useState, type ReactNode } from 'react';
import { EventRow } from './EventRow';
import { eventStatus, partitionByToday } from './event-status';
import { weekdayName } from './month-grid';

const hrefOf = (occurrence: Occurrence, linkEvents: boolean) => {
  if (occurrence.personId) return `/gia-pha/${occurrence.treeId}/nguoi/${occurrence.personId}`;
  return linkEvents ? `/gia-pha/${occurrence.treeId}/su-kien?xem=${occurrence.eventId ?? ''}` : null;
};

const keyOf = (occurrence: Occurrence, index: number) =>
  `${occurrence.kind}-${occurrence.personId ?? occurrence.eventId}-${occurrence.date.year}-${occurrence.date.month}-${occurrence.date.day}-${index}`;

type Props = {
  /** Đã sắp theo ngày tăng dần. */
  occurrences: readonly Occurrence[];
  /** Hôm nay, để phân đã qua / hôm nay / sắp tới. */
  today: SolarDate;
  /** Hiện ô ngày ở mỗi dòng (danh sách nhiều ngày); trong ô một ngày thì không cần. */
  showDate?: boolean;
  /** Hiện tên Gia phả khi tài khoản thuộc nhiều Gia phả. */
  showTree?: boolean;
  /** Tên sự kiện (không gắn Người) bấm được, dẫn về trang Sự kiện. Tắt ở chính trang đó. */
  linkEvents?: boolean;
  /**
   * Sắp tới (từ hôm nay) lên trên; sự kiện đã qua gập sau nút "Đã qua (N)", mở ra mới thấy (mới nhất trước).
   * Dữ liệu đã có sẵn trong bộ nhớ nên mở/gập không gọi thêm API. Tắt thì đã qua và sắp tới nằm chung theo ngày, ngăn bằng vạch "Hôm nay".
   */
  collapsePast?: boolean;
  extra?: (occurrence: Occurrence) => ReactNode;
  actions?: (occurrence: Occurrence) => ReactNode;
};

/** Danh sách giỗ, sinh nhật, Sự kiện. */
export const OccurrenceList = ({ occurrences, today, showDate = false, showTree = false, linkEvents = true, collapsePast = false, extra, actions }: Props) => {
  const [pastOpen, setPastOpen] = useState(false);
  const isPast = (occurrence: Occurrence) => eventStatus(occurrence.date, today).state === 'past';

  const row = (occurrence: Occurrence, index: number) => (
    <li key={keyOf(occurrence, index)}>
      <EventRow
        occurrence={occurrence}
        today={today}
        href={hrefOf(occurrence, linkEvents)}
        showDate={showDate}
        showTree={showTree}
        extra={extra?.(occurrence)}
        actions={actions?.(occurrence)}
      />
    </li>
  );

  const listClass = 'divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface';

  if (!collapsePast) {
    const firstUpcoming = occurrences.findIndex((occurrence) => !isPast(occurrence));
    const dividerAt = firstUpcoming > 0 ? firstUpcoming : -1;
    return (
      <ul className={listClass}>
        {occurrences.flatMap((occurrence, index) => {
          if (index !== dividerAt) return [row(occurrence, index)];
          return [
            <li key="hom-nay" className="flex items-center gap-3 bg-paper px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-son">
              <span aria-hidden="true" className="h-0.5 flex-1 bg-son/35" />
              <span>
                Hôm nay · {weekdayName(today)} {today.day}/{today.month}
              </span>
              <span aria-hidden="true" className="h-0.5 flex-1 bg-son/35" />
            </li>,
            row(occurrence, index),
          ];
        })}
      </ul>
    );
  }

  const { upcoming, past } = partitionByToday(occurrences, today);
  return (
    <ul className={listClass}>
      {upcoming.map((occurrence, index) => row(occurrence, index))}
      {upcoming.length === 0 && <li className="px-4 py-3.5 text-ink-muted">Không còn sự kiện nào sắp tới.</li>}
      {past.length > 0 && (
        <li>
          <button
            type="button"
            aria-expanded={pastOpen}
            onClick={() => setPastOpen((open) => !open)}
            className="flex min-h-12 w-full items-center gap-2 bg-paper px-4 py-2.5 text-left text-sm font-semibold text-past-ink hover:bg-past"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className={`size-4 fill-none stroke-current ${pastOpen ? 'rotate-180' : ''}`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6l4 4 4-4" />
            </svg>
            Đã qua ({past.length})
          </button>
        </li>
      )}
      {pastOpen && past.map((occurrence, index) => row(occurrence, upcoming.length + index))}
    </ul>
  );
};
