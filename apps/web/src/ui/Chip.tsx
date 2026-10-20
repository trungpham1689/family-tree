import type { ReactNode } from 'react';

/** Nút bật/tắt dạng viên thuốc, có dấu tick khi bật; cao 44px để dễ chạm. */
export const Chip = ({ on, disabled, onClick, children }: { on: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    aria-pressed={on}
    disabled={disabled}
    onClick={onClick}
    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-sm ${
      on ? 'border-son bg-son/7 font-semibold text-son' : 'border-line bg-surface font-medium'
    } disabled:cursor-not-allowed disabled:text-ink-muted/60`}
  >
    {on && (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 fill-none stroke-current" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10.5l4 4 8-9" />
      </svg>
    )}
    {children}
  </button>
);
