import type { ReactNode } from 'react';

export const FullPageMessage = ({ children }: { children: ReactNode }) => (
  <main id="main" tabIndex={-1} className="focus:outline-none grid min-h-dvh place-items-center p-6 text-ink-muted">
    <div role="status">{children}</div>
  </main>
);
