import { useState, type FormEvent } from 'react';
import { profileError, today, type ProfileValues } from '../data/profile';
import { Button } from '../ui/Button';
import { ErrorBanner, TextField } from '../ui/fields';

type ProfileFormProps = {
  initial: ProfileValues;
  pending: boolean;
  /** Lỗi từ database khi lưu. */
  error?: string | undefined;
  onSubmit: (values: ProfileValues) => void;
  onCancel: () => void;
};

/** Form sửa họ tên, ngày sinh, số điện thoại: dùng cho người dùng sửa hồ sơ mình và siêu quản trị sửa hồ sơ người khác. */
export const ProfileForm = ({ initial, pending, error, onSubmit, onCancel }: ProfileFormProps) => {
  const [values, setValues] = useState(initial);
  const [invalid, setInvalid] = useState<string | null>(null);
  const set = (key: keyof ProfileValues) => (event: { target: { value: string } }) => setValues({ ...values, [key]: event.target.value });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = profileError(values);
    setInvalid(problem);
    if (!problem) onSubmit({ fullName: values.fullName.trim(), birthDate: values.birthDate, phone: values.phone.trim() });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField label="Họ và tên" required maxLength={120} autoComplete="name" value={values.fullName} onChange={set('fullName')} />
      <TextField label="Ngày sinh" type="date" required min="1900-01-01" max={today()} value={values.birthDate} onChange={set('birthDate')} />
      <TextField label="Số điện thoại" type="tel" required maxLength={20} autoComplete="tel" value={values.phone} onChange={set('phone')} />
      {(invalid ?? error) && <ErrorBanner>{invalid ?? error}</ErrorBanner>}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Huỷ
        </Button>
        <Button type="submit" disabled={pending}>
          Lưu
        </Button>
      </div>
    </form>
  );
};
