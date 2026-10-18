import { Link } from 'react-router';
import { MARK_COLORS } from './mark-colors';
import { weekdayName } from './month-grid';
import type { Occurrence } from './occurrences';

const hrefOf = (occurrence: Occurrence) =>
  occurrence.personId
    ? `/gia-pha/${occurrence.treeId}/nguoi/${occurrence.personId}`
    : `/gia-pha/${occurrence.treeId}/su-kien#${occurrence.eventId ?? ''}`;

type Props = {
  occurrences: readonly Occurrence[];
  /** Hiện ngày ở mỗi dòng (màn "Sắp tới"); trong ô một ngày thì không cần. */
  showDate?: boolean;
  /** Hiện tên Gia phả khi tài khoản thuộc nhiều Gia phả. */
  showTree?: boolean;
};

/** Danh sách giỗ, sinh nhật, Sự kiện; mỗi dòng dẫn về Người hoặc Sự kiện tương ứng. */
export const OccurrenceList = ({ occurrences, showDate = false, showTree = false }: Props) => (
  <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
    {occurrences.map((occurrence) => (
      <li key={`${occurrence.kind}-${occurrence.personId ?? occurrence.eventId}-${occurrence.date.year}-${occurrence.date.month}-${occurrence.date.day}`}>
        <Link to={hrefOf(occurrence)} className="flex items-start gap-3 px-4 py-3 hover:bg-paper">
          <span aria-hidden="true" className={`mt-2 size-2.5 shrink-0 rounded-full ${MARK_COLORS[occurrence.kind]}`} />
          <span className="min-w-0 flex-1">
            {showDate && (
              <span className="block text-sm font-semibold text-son">
                {weekdayName(occurrence.date)}, {occurrence.date.day}/{occurrence.date.month}/{occurrence.date.year}
              </span>
            )}
            <span className="block font-semibold">{occurrence.title}</span>
            <span className="block text-sm text-ink-muted">
              {[occurrence.detail, showTree ? occurrence.treeName : null].filter(Boolean).join(' · ')}
            </span>
          </span>
        </Link>
      </li>
    ))}
  </ul>
);
