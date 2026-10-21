import type { SolarDate } from '@gia-pha/lunar';
import type { Occurrence } from '@gia-pha/reminders';
import { useState, type ReactNode } from 'react';
import { EventRow } from './EventRow';
import { eventStatus } from './event-status';
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
  /** Chỉ hiện chừng này sự kiện đã qua gần nhất; phần cũ hơn gập sau một nút. Bỏ trống thì hiện hết. */
  pastVisible?: number;
  extra?: (occurrence: Occurrence) => ReactNode;
  actions?: (occurrence: Occurrence) => ReactNode;
};

/**
 * Danh sách giỗ, sinh nhật, Sự kiện. Nếu có cả đã qua lẫn từ hôm nay trở đi thì đã qua nằm trên,
 * ngăn bằng vạch "Hôm nay".
 */
export const OccurrenceList = ({ occurrences, today, showDate = false, showTree = false, linkEvents = true, pastVisible, extra, actions }: Props) => {
  const [showAllPast, setShowAllPast] = useState(false);
  const pastCount = occurrences.filter((occurrence) => eventStatus(occurrence.date, today).state === 'past').length;
  const hidden = pastVisible !== undefined && !showAllPast ? Math.max(0, pastCount - pastVisible) : 0;

  const items: ReactNode[] = [];
  let pastSeen = 0;
  let dividerDone = false;
  occurrences.forEach((occurrence, index) => {
    const isPast = eventStatus(occurrence.date, today).state === 'past';
    if (isPast) {
      pastSeen += 1;
      if (pastSeen <= hidden) return;
    } else if (!dividerDone && pastCount > 0) {
      dividerDone = true;
      items.push(
        <li key="hom-nay" className="flex items-center gap-3 bg-paper px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-son sm:px-5">
          <span aria-hidden="true" className="h-0.5 flex-1 bg-son/35" />
          <span>
            Hôm nay · {weekdayName(today)} {today.day}/{today.month}
          </span>
          <span aria-hidden="true" className="h-0.5 flex-1 bg-son/35" />
        </li>,
      );
    }
    items.push(
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
      </li>,
    );
  });

  const toggleVisible = pastVisible !== undefined && pastCount > pastVisible;

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {toggleVisible && (
        <li>
          <button
            type="button"
            aria-expanded={showAllPast}
            onClick={() => setShowAllPast((value) => !value)}
            className="flex min-h-12 w-full items-center gap-2 bg-paper px-4 py-2.5 text-left text-sm font-semibold text-past-ink hover:bg-past sm:px-5"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className={`size-4 fill-none stroke-current ${showAllPast ? 'rotate-180' : ''}`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6l4 4 4-4" />
            </svg>
            {showAllPast ? 'Ẩn bớt sự kiện đã qua' : `Hiện thêm ${hidden} sự kiện đã qua`}
          </button>
        </li>
      )}
      {items}
    </ul>
  );
};
