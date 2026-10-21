import type { SolarDate } from '@gia-pha/lunar';
import type { Occurrence } from '@gia-pha/reminders';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { eventStatus, weekdayShort, type EventState } from './event-status';
import { MARK_LABELS, markDotClass } from './mark-colors';
import { weekdayName } from './month-grid';

const ROW_BG: Record<EventState, string> = {
  past: 'bg-past',
  today: 'bg-today-soft',
  near: 'bg-near',
  later: 'bg-surface',
};

const TILE: Record<EventState, string> = {
  past: 'bg-past-strong text-ink-muted',
  today: 'bg-son text-white',
  near: 'bg-kim-soft text-near-ink',
  later: 'border border-line bg-surface text-ink',
};

const PILL: Record<EventState, string> = {
  past: 'bg-past-strong px-3 text-past-ink',
  today: 'bg-son px-3 text-white',
  near: 'bg-kim-soft px-3 text-near-ink',
  later: 'font-medium text-ink-muted',
};

type Props = {
  occurrence: Occurrence;
  today: SolarDate;
  /** Đích khi bấm vào tên; bỏ trống thì tên là chữ thường. */
  href?: string | null;
  /** Hiện ô ngày bên trái (danh sách nhiều ngày); trong ô một ngày thì không cần. */
  showDate?: boolean;
  /** Hiện tên Gia phả khi tài khoản thuộc nhiều Gia phả. */
  showTree?: boolean;
  /** Chi tiết thêm dưới dòng chi tiết (vd ảnh, người liên quan). */
  extra?: ReactNode;
  /** Nút cho dòng (Sửa, Xóa…). */
  actions?: ReactNode;
};

/**
 * Một dòng giỗ, sinh nhật, kỷ niệm cưới hay Sự kiện, dùng chung mọi nơi hiển thị.
 * Bốn trạng thái so với hôm nay (đã qua, hôm nay, trong 7 ngày tới, sắp tới) khác nhau về nền, ô ngày,
 * chấm loại (rỗng nếu đã qua) và nhãn chữ, không chỉ bằng màu.
 */
export const EventRow = ({ occurrence, today, href, showDate = false, showTree = false, extra, actions }: Props) => {
  const status = eventStatus(occurrence.date, today);
  const { date } = occurrence;
  const isPast = status.state === 'past';
  const titleClass = `font-semibold ${isPast ? 'text-ink-muted' : ''}`;
  const kindLabel = MARK_LABELS[occurrence.kind];

  return (
    <div className={`relative flex flex-col gap-2.5 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5 ${ROW_BG[status.state]}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
        {showDate && (
          <div
            aria-hidden="true"
            className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl text-xs leading-tight ${TILE[status.state]}`}
          >
            <span className="font-semibold tracking-wide">{weekdayShort(date)}</span>
            <span className="text-2xl font-bold tabular-nums leading-none">{date.day}</span>
            <span className="font-medium tabular-nums">
              Th{date.month}
              {date.year !== today.year && `/${date.year}`}
            </span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <span aria-hidden="true" className={markDotClass(occurrence.kind, isPast)} />
            <span className="capitalize">{kindLabel}</span>
            {showTree && <span>· {occurrence.treeName}</span>}
          </p>
          <p className={titleClass}>
            {showDate && <span className="sr-only">{weekdayName(date)}, {date.day}/{date.month}/{date.year}. </span>}
            {href ? (
              // Liên kết trải kín cả dòng (::after) để dễ chạm; nút ở `actions` nổi lên trên bằng z-10.
              <Link to={href} className="after:absolute after:inset-0 hover:underline">
                {occurrence.title}
              </Link>
            ) : (
              occurrence.title
            )}
          </p>
          {occurrence.detail && <p className="text-sm text-ink-muted">{occurrence.detail}</p>}
          {extra && <div className="relative z-10">{extra}</div>}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 sm:shrink-0 sm:justify-end">
        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-1.5 text-sm font-semibold ${PILL[status.state]}`}>
          {isPast && (
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8.5l3.2 3L13 4.5" />
            </svg>
          )}
          {status.label}
        </span>
        {actions && <div className="relative z-10 min-w-0">{actions}</div>}
      </div>
    </div>
  );
};
