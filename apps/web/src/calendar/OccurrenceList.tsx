import { julianDay, type SolarDate } from '@gia-pha/lunar';
import { Link } from 'react-router';
import { MARK_COLORS, MARK_LABELS } from './mark-colors';
import { weekdayName } from './month-grid';
import type { Occurrence } from '@gia-pha/reminders';

const hrefOf = (occurrence: Occurrence) =>
  occurrence.personId
    ? `/gia-pha/${occurrence.treeId}/nguoi/${occurrence.personId}`
    : `/gia-pha/${occurrence.treeId}/su-kien?xem=${occurrence.eventId ?? ''}`;

/** Trong vòng bao nhiêu ngày tới thì coi là "gần đến ngày", cần nổi bật. */
const NEAR_DAYS = 7;

type Props = {
  occurrences: readonly Occurrence[];
  /** Hiện ngày ở mỗi dòng (màn "Sắp tới"); trong ô một ngày thì không cần. */
  showDate?: boolean;
  /** Hiện tên Gia phả khi tài khoản thuộc nhiều Gia phả. */
  showTree?: boolean;
  /** Hôm nay, để làm mờ sự kiện đã qua và nổi bật sự kiện gần đến ngày. Bỏ trống thì không phân biệt. */
  today?: SolarDate;
};

/** Danh sách giỗ, sinh nhật, Sự kiện; mỗi dòng dẫn về Người hoặc Sự kiện tương ứng. */
export const OccurrenceList = ({ occurrences, showDate = false, showTree = false, today }: Props) => (
  <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
    {occurrences.map((occurrence) => {
      const daysAway = today ? julianDay(occurrence.date) - julianDay(today) : null;
      const isPast = daysAway !== null && daysAway < 0;
      const isNear = daysAway !== null && daysAway >= 0 && daysAway <= NEAR_DAYS;
      return (
        <li key={`${occurrence.kind}-${occurrence.personId ?? occurrence.eventId}-${occurrence.date.year}-${occurrence.date.month}-${occurrence.date.day}`}>
          <Link
            to={hrefOf(occurrence)}
            className={`flex items-start gap-3 px-4 py-3 hover:bg-paper ${isNear ? 'bg-kim-soft/40' : ''}`}
          >
            <span aria-hidden="true" className={`mt-2 size-2.5 shrink-0 rounded-full ${MARK_COLORS[occurrence.kind]}`} />
            <span className="min-w-0 flex-1">
              {showDate && (
                <span className={`block text-sm font-semibold ${isPast ? 'text-ink-muted' : 'text-son'}`}>
                  {weekdayName(occurrence.date)}, {occurrence.date.day}/{occurrence.date.month}/{occurrence.date.year}
                </span>
              )}
              <span className={`block font-semibold ${isPast ? 'text-ink-muted' : ''}`}>
                <span className="sr-only">{MARK_LABELS[occurrence.kind]}: </span>
                {occurrence.title}
              </span>
              <span className="block text-sm text-ink-muted">
                {[
                  occurrence.detail,
                  showTree ? occurrence.treeName : null,
                  isPast ? 'Đã qua' : isNear ? (daysAway === 0 ? 'Hôm nay' : `Còn ${daysAway} ngày`) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          </Link>
        </li>
      );
    })}
  </ul>
);
