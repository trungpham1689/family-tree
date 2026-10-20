import type { ReactNode } from 'react';

type ChoiceChipProps = {
  checked: boolean;
  onChange: () => void;
  /** Cùng `name` cho cả nhóm để phím mũi tên chuyển giữa các lựa chọn. */
  name: string;
  /** Cao 44px thay vì 48px, cho chỗ chật. */
  compact?: boolean;
  className?: string;
  children: ReactNode;
};

/** Lựa chọn một trong nhóm dạng viên: radio thật ẩn bằng sr-only, nhãn vẽ viền; vòng focus vẽ ở nhãn vì ô radio không nhìn thấy. */
export const ChoiceChip = ({ checked, onChange, name, compact = false, className = '', children }: ChoiceChipProps) => (
  <label
    className={`flex ${compact ? 'min-h-11' : 'min-h-12'} cursor-pointer items-center rounded-xl border px-4 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus ${
      checked ? 'border-son bg-son/5 font-semibold text-son' : 'border-control'
    } ${className}`}
  >
    <input type="radio" name={name} className="sr-only" checked={checked} onChange={onChange} />
    {children}
  </label>
);
