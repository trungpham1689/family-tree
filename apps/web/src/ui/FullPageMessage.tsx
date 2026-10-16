import type { ReactNode } from 'react';

export const FullPageMessage = ({ children }: { children: ReactNode }) => (
  <main className="grid min-h-dvh place-items-center p-6 text-ink-muted">{children}</main>
);
