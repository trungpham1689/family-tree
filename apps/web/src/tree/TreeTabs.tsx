import { useEffect, useRef, useState } from 'react';
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

/** Thanh tab chuyển giữa các phần của một gia phả: menu hamburger dưới 900px (8 tab cần ~840px, hẹp hơn sẽ bị cắt tab cuối), hàng tab từ 900px trở lên. */
export const TreeTabs = ({ treeId }: { treeId: string }) => {
  const location = useLocation();
  // Menu mở ở đúng trang đã bấm: đổi trang thì tự coi như đóng, không cần effect đặt lại state.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === location.pathname;
  const setOpen = (value: boolean | ((current: boolean) => boolean)) =>
    setOpenPath((current) => ((typeof value === 'function' ? value(current === location.pathname) : value) ? location.pathname : null));
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  // Trang không thuộc tab nào (như trang một Người) thì không tô tab nào cả.
  const active = TABS.find((tab) => isTabActive(tab, treeId, location.pathname));

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpenPath(null);
      menuButtonRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <nav aria-label="Các phần của gia phả" className="border-b border-line bg-surface">
      <div className="mx-auto max-w-4xl px-4">
        <button
          ref={menuButtonRef}
          type="button"
          aria-expanded={open}
          aria-controls="tree-tabs-menu"
          aria-label={`${active?.label ?? 'Các phần của gia phả'} – mở menu các phần của gia phả`}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-12 w-full items-center gap-3 font-semibold text-son min-[900px]:hidden"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
          {active?.label ?? 'Các phần của gia phả'}
        </button>
        {open && (
          <div id="tree-tabs-menu" className="flex flex-col pb-2 min-[900px]:hidden">
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
        <div className="hidden gap-1 overflow-x-auto min-[900px]:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
