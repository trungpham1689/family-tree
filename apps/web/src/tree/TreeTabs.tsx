import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router';

const TABS: { to: (treeId: string) => string; label: string; end?: boolean }[] = [
  { to: (treeId) => `/gia-pha/${treeId}`, label: 'Tổng quan', end: true },
  { to: (treeId) => `/gia-pha/${treeId}/cay`, label: 'Cây gia phả' },
  { to: (treeId) => `/gia-pha/${treeId}/pha-do`, label: 'Phả đồ' },
  { to: (treeId) => `/gia-pha/${treeId}/pha-ky`, label: 'Phả ký' },
  { to: (treeId) => `/gia-pha/${treeId}/dong-thoi-gian`, label: 'Dòng thời gian' },
  { to: (treeId) => `/gia-pha/${treeId}/su-kien`, label: 'Sự kiện' },
  { to: (treeId) => `/gia-pha/${treeId}/quan-he`, label: 'Tra cứu' },
  { to: (treeId) => `/gia-pha/${treeId}/thieu-thong-tin`, label: 'Cần cập nhật' },
];

const isTabActive = (tab: (typeof TABS)[number], treeId: string, pathname: string) => {
  const to = tab.to(treeId);
  return tab.end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
};

/** Thanh tab chuyển giữa các phần của một gia phả: menu hamburger trên mobile (khỏi cuộn ngang), hàng tab từ sm trở lên. */
export const TreeTabs = ({ treeId }: { treeId: string }) => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const active = TABS.find((tab) => isTabActive(tab, treeId, location.pathname)) ?? TABS[0]!;

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <nav aria-label="Các phần của gia phả" className="border-b border-line bg-surface">
      <div className="mx-auto max-w-4xl px-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="tree-tabs-menu"
          aria-label="Menu các phần của gia phả"
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-12 w-full items-center gap-3 font-semibold text-son sm:hidden"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
          {active.label}
        </button>
        {open && (
          <div id="tree-tabs-menu" className="flex flex-col pb-2 sm:hidden">
            {TABS.map((tab) => (
              <NavLink
                key={tab.label}
                to={tab.to(treeId)}
                end={tab.end}
                className={({ isActive }) =>
                  `flex min-h-12 items-center rounded-xl px-3 font-semibold ${isActive ? 'bg-son/5 text-son' : 'text-ink hover:bg-son/5'}`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
        )}
        <div className="hidden gap-1 overflow-x-auto sm:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => (
            <NavLink
              key={tab.label}
              to={tab.to(treeId)}
              end={tab.end}
              className={({ isActive }) =>
                `flex min-h-12 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold ${
                  isActive ? 'border-son text-son' : 'border-transparent text-ink-muted hover:text-ink'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
};
