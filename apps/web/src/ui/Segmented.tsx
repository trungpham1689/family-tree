import { onTabKeyDown } from './tab-keys';

type Option<T extends string> = { value: T; label: string };

/**
 * Thanh chọn một trong vài mục, các mục chia đều chiều ngang.
 * Mặc định là nhóm nút radio; truyền `tabs` thì là nhóm tab (kèm bàn phím mũi tên, Home/End) điều khiển vùng `panelId`.
 */
export const Segmented = <T extends string>({
  label,
  options,
  value,
  onChange,
  tabs,
  className = '',
}: {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  tabs?: { idPrefix: string; panelId: string };
  className?: string;
}) => (
  <div
    role={tabs ? 'tablist' : 'radiogroup'}
    aria-label={label}
    className={`flex gap-1 rounded-xl bg-line/50 p-1 ${className}`}
    {...(tabs
      ? { onKeyDown: (event) => onTabKeyDown(event, options.map((option) => option.value), value, onChange, (id) => `${tabs.idPrefix}-${id}`) }
      : {})}
  >
    {options.map((option) => {
      const on = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          {...(tabs
            ? { role: 'tab', id: `${tabs.idPrefix}-${option.value}`, 'aria-selected': on, 'aria-controls': tabs.panelId, tabIndex: on ? 0 : -1 }
            : { role: 'radio', 'aria-checked': on })}
          onClick={() => onChange(option.value)}
          className={`min-h-11 min-w-0 flex-1 rounded-lg px-1.5 text-sm ${on ? 'bg-surface font-bold text-son shadow-sm' : 'font-medium text-ink hover:bg-surface/60'}`}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);
