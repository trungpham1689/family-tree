import { NavLink } from 'react-router';

const TABS: { to: (treeId: string) => string; label: string; end?: boolean }[] = [
  { to: (treeId) => `/gia-pha/${treeId}`, label: 'Tổng quan', end: true },
  { to: (treeId) => `/gia-pha/${treeId}/cay`, label: 'Cây gia phả' },
  { to: (treeId) => `/gia-pha/${treeId}/pha-do`, label: 'Phả đồ' },
  { to: (treeId) => `/gia-pha/${treeId}/pha-ky`, label: 'Phả ký' },
  { to: (treeId) => `/gia-pha/${treeId}/su-kien`, label: 'Sự kiện' },
  { to: (treeId) => `/gia-pha/${treeId}/quan-he`, label: 'Tra cứu quan hệ' },
  { to: (treeId) => `/gia-pha/${treeId}/thieu-thong-tin`, label: 'Hồ sơ thiếu' },
];

/** Thanh tab chuyển giữa các phần của một gia phả, hiện trên mọi trang con của gia phả. */
export const TreeTabs = ({ treeId }: { treeId: string }) => (
  <nav
    aria-label="Các phần của gia phả"
    className="border-b border-line bg-surface [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]"
  >
    <div className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TABS.map((tab) => (
        <NavLink
          key={tab.label}
          to={tab.to(treeId)}
          end={tab.end}
          className={({ isActive }) =>
            `flex min-h-12 shrink-0 items-center whitespace-nowrap border-b-2 px-2.5 text-xs font-semibold sm:px-3 sm:text-sm ${
              isActive ? 'border-son text-son' : 'border-transparent text-ink-muted hover:text-ink'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  </nav>
);
