import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Person } from '../../data/trees';
import { lifespanText } from '../person-display';

export const Section = ({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) => (
  <section className="mt-8">
    <div className="flex items-center justify-between gap-4">
      <h2 className="font-serif text-xl font-bold">{title}</h2>
      {action}
    </div>
    <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{children}</ul>
  </section>
);

export const RelativeRow = ({
  treeId,
  relative,
  caption,
  children,
}: {
  treeId: string;
  relative: Person;
  caption: string;
  children?: ReactNode;
}) => (
  <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
    <Link to={`/gia-pha/${treeId}/nguoi/${relative.id}`} className="group">
      {caption && <span className="block text-sm text-ink-muted">{caption}</span>}
      <span className="text-lg font-semibold group-hover:text-son group-hover:underline">{relative.full_name}</span>
      <span className="ml-2 text-ink-muted">{lifespanText(relative)}</span>
    </Link>
    {children}
  </li>
);

export const Empty = ({ children }: { children: ReactNode }) => <li className="px-5 py-3 text-ink-muted">{children}</li>;

export const Tag = ({ children }: { children: ReactNode }) => (
  <span className="rounded-full border border-line bg-surface px-3 py-1">{children}</span>
);
