import type { ReactNode } from 'react';

/** Khối gập/mở gọn (dùng thẻ <details> có sẵn của trình duyệt, không cần JS riêng). */
export const Collapsible = ({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) => (
  <details className="group rounded-xl border border-line bg-surface" open={defaultOpen}>
    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 font-medium marker:content-none [&::-webkit-details-marker]:hidden">
      {title}
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="size-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180"
      >
        <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </summary>
    <div className="space-y-3 border-t border-line px-4 py-4">{children}</div>
  </details>
);
