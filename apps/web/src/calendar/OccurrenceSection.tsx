import type { SolarDate } from '@gia-pha/lunar';
import type { Occurrence } from '@gia-pha/reminders';
import { OccurrenceList } from './OccurrenceList';

type Props = {
  title: string;
  occurrences: readonly Occurrence[];
  today: SolarDate;
  emptyText: string;
  showTree?: boolean;
};

/** Khối tiêu đề + danh sách (hoặc trạng thái rỗng) cho một nhóm giỗ/sinh nhật/Sự kiện. */
export const OccurrenceSection = ({ title, occurrences, today, emptyText, showTree }: Props) => (
  <section>
    <h2 className="mb-2 font-serif text-xl font-bold">{title}</h2>
    {occurrences.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-line bg-surface px-6 py-8 text-center text-ink-muted">{emptyText}</p>
    ) : (
      <OccurrenceList occurrences={occurrences} showDate today={today} showTree={showTree} />
    )}
  </section>
);
