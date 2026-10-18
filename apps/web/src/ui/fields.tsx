import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const CONTROL = 'min-h-12 w-full rounded-xl border bg-surface px-4';

const CHEVRON_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%235c534c' stroke-width='2'%3E%3Cpath d='M6 8l4 4 4-4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

/** `<select>` dùng chung: tắt mũi tên gốc trình duyệt (hay dính sát viền), tự vẽ mũi tên cách viền đều. */
export const Select = ({ className = '', style, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={`min-h-12 rounded-xl border border-line bg-surface py-0 pl-4 pr-10 appearance-none ${className}`}
    style={{
      backgroundImage: `url("${CHEVRON_SVG}")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 0.9rem center',
      backgroundSize: '1rem',
      ...style,
    }}
    {...props}
  />
);

type FieldShellProps = {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  id: string;
  required?: boolean | undefined;
  children: ReactNode;
};

const FieldShell = ({ label, hint, error, id, required, children }: FieldShellProps) => (
  <div>
    <label htmlFor={id} className="mb-1 block font-medium">
      {label}
      {required && (
        <span className="text-danger" aria-hidden="true">
          {' '}
          *
        </span>
      )}
    </label>
    {children}
    {error ? (
      <p id={`${id}-error`} className="mt-1 text-sm text-danger">
        {error}
      </p>
    ) : (
      hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>
    )}
  </div>
);

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string | undefined; error?: string | undefined };

export const TextField = ({ label, hint, error, className = '', ...props }: TextFieldProps) => {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} error={error} id={id} required={props.required}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${CONTROL} ${error ? 'border-danger' : 'border-line'} ${className}`}
        {...props}
      />
    </FieldShell>
  );
};

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string | undefined };

export const TextAreaField = ({ label, hint, className = '', ...props }: TextAreaFieldProps) => {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} id={id}>
      <textarea id={id} className={`${CONTROL} border-line py-3 ${className}`} rows={3} {...props} />
    </FieldShell>
  );
};

export const ErrorBanner = ({ children }: { children: ReactNode }) => (
  <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-danger">
    {children}
  </p>
);
