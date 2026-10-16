import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-son text-white hover:bg-son-strong disabled:bg-son/50',
  secondary: 'border border-line bg-surface text-ink hover:bg-paper disabled:text-ink-muted',
  ghost: 'text-son hover:bg-son/5 disabled:text-ink-muted',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

/** Nút bấm cao ít nhất 48px để dễ chạm trên điện thoại. */
export const Button = ({ variant = 'primary', className = '', ...props }: ButtonProps) => (
  <button
    type="button"
    className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-semibold transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
    {...props}
  />
);
