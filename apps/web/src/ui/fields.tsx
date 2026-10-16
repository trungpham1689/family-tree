import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

const CONTROL = 'min-h-12 w-full rounded-xl border bg-surface px-4';

type FieldShellProps = { label: string; hint?: string | undefined; error?: string | undefined; id: string; children: ReactNode };

const FieldShell = ({ label, hint, error, id, children }: FieldShellProps) => (
  <div>
    <label htmlFor={id} className="mb-1 block font-medium">
      {label}
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
    <FieldShell label={label} hint={hint} error={error} id={id}>
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
