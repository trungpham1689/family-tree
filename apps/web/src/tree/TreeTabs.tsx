import { NavLink, useLocation, useNavigate } from 'react-router';

const TABS: { to: (treeId: string) => string; label: string; end?: boolean }[] = [
  { to: (treeId) => `/gia-pha/${treeId}`, label: 'Tổng quan', end: true },
  { to: (treeId) => `/gia-pha/${treeId}/cay`, label: 'Cây gia phả' },
  { to: (treeId) => `/gia-pha/${treeId}/pha-do`, label: 'Phả đồ' },
  { to: (treeId) => `/gia-pha/${treeId}/pha-ky`, label: 'Phả ký' },
  { to: (treeId) => `/gia-pha/${treeId}/su-kien`, label: 'Sự kiện' },
  { to: (treeId) => `/gia-pha/${treeId}/quan-he`, label: 'Tra cứu quan hệ' },
  { to: (treeId) => `/gia-pha/${treeId}/thieu-thong-tin`, label: 'Hồ sơ thiếu' },
];

const isTabActive = (tab: (typeof TABS)[number], treeId: string, pathname: string) => {
  const to = tab.to(treeId);
  return tab.end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
};

/** Thanh tab chuyển giữa các phần của một gia phả: dropdown trên mobile (khỏi cuộn ngang), hàng tab từ sm trở lên. */
export const TreeTabs = ({ treeId }: { treeId: string }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const current = TABS.find((tab) => isTabActive(tab, treeId, location.pathname))?.to(treeId) ?? TABS[0]!.to(treeId);

  return (
    <nav aria-label="Các phần của gia phả" className="border-b border-line bg-surface">
      <div className="mx-auto max-w-4xl px-4">
        <select
          aria-label="Các phần của gia phả"
          className="block min-h-12 w-full border-0 bg-transparent font-semibold text-son sm:hidden"
          value={current}
          onChange={(event) => navigate(event.target.value)}
        >
          {TABS.map((tab) => (
            <option key={tab.label} value={tab.to(treeId)}>
              {tab.label}
            </option>
          ))}
        </select>
        <div className="hidden gap-1 sm:flex">
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
