import { useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import { ErrorBanner, TextField } from '../ui/fields';
import { parsePersonForm, type PersonFields, type PersonFormErrors, type PersonFormValues } from './person-form';

type PersonFormProps = {
  initial: PersonFormValues;
  submitLabel: string;
  busy: boolean;
  serverError: string | null;
  onSubmit: (fields: PersonFields) => void;
  onCancel: () => void;
};

const GENDER_OPTIONS = [
  ['', 'Chưa rõ'],
  ['nam', 'Nam'],
  ['nu', 'Nữ'],
] as const;

export const PersonForm = ({ initial, submitLabel, busy, serverError, onSubmit, onCancel }: PersonFormProps) => {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<PersonFormErrors>({});

  const set = <Key extends keyof PersonFormValues>(key: Key, value: PersonFormValues[Key]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = parsePersonForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSubmit(result.fields);
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField
        label="Họ và tên"
        autoFocus
        maxLength={200}
        value={values.fullName}
        error={errors.fullName}
        onChange={(event) => set('fullName', event.target.value)}
      />

      <fieldset>
        <legend className="mb-1 font-medium">Giới tính</legend>
        <div className="flex flex-wrap gap-2">
          {GENDER_OPTIONS.map(([value, label]) => (
            <label
              key={value}
              className={`flex min-h-12 cursor-pointer items-center rounded-xl border px-4 ${
                values.gender === value ? 'border-son bg-son/5 font-semibold text-son' : 'border-line'
              }`}
            >
              <input
                type="radio"
                name="gender"
                className="sr-only"
                checked={values.gender === value}
                onChange={() => set('gender', value)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Năm sinh"
          inputMode="numeric"
          placeholder="1925"
          value={values.birthYear}
          error={errors.birthYear}
          onChange={(event) => set('birthYear', event.target.value)}
        />
        <TextField
          label="Năm mất"
          inputMode="numeric"
          placeholder="Để trống nếu còn sống"
          value={values.deathYear}
          error={errors.deathYear}
          onChange={(event) => set('deathYear', event.target.value)}
        />
      </div>

      <label className="flex min-h-12 items-center gap-3">
        <input
          type="checkbox"
          className="size-5 accent-son"
          checked={values.isDeceased || values.deathYear.trim() !== ''}
          disabled={values.deathYear.trim() !== ''}
          onChange={(event) => set('isDeceased', event.target.checked)}
        />
        Đã mất (kể cả khi không rõ năm mất)
      </label>

      {serverError && <ErrorBanner>{serverError}</ErrorBanner>}

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Huỷ
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Đang lưu…' : submitLabel}
        </Button>
      </div>
    </form>
  );
};
