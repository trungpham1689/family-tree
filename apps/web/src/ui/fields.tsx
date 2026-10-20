import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

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

/** Ô mật khẩu có nút con mắt hiện/ẩn chữ (người lớn tuổi hay gõ nhầm mà không kiểm tra được). Truyền thuộc tính như <input>; `type` do nút quyết định. */
export const PasswordInput = ({ style, ...props }: InputHTMLAttributes<HTMLInputElement>) => {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? 'text' : 'password'} style={{ paddingRight: '3.25rem', ...style }} />
      <button
        type="button"
        aria-label={shown ? 'Ẩn chữ đã gõ' : 'Hiện chữ đã gõ'}
        aria-pressed={shown}
        onClick={() => setShown((value) => !value)}
        className="absolute right-0.5 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:text-ink"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {shown ? (
            <path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4.1M6.5 6.6C3.6 8.4 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.4 4.5-1.1M9.9 9.9a3 3 0 004.2 4.2" />
          ) : (
            <>
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
};

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
      {props.type === 'password' ? (
        <PasswordInput
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${CONTROL} ${error ? 'border-danger' : 'border-line'} ${className}`}
          {...props}
        />
      ) : (
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${CONTROL} ${error ? 'border-danger' : 'border-line'} ${className}`}
          {...props}
        />
      )}
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
