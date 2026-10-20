import { useMemo, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { Button } from '../ui/Button';
import { ChoiceChip } from '../ui/ChoiceChip';
import { ErrorBanner, TextAreaField, TextField } from '../ui/fields';
import { focusFirstInvalid } from '../ui/focus-first-invalid';
import { findDuplicates } from './duplicate-check';
import { personLabel } from './person-label';
import { PersonPicker } from './PersonPicker';
import { fieldLabel, formFields, TEXT_FIELDS, type ProfileTextField } from './profile-fields';
import { PartialDateField } from './PartialDateField';
import {
  parsePersonForm,
  suggestedAnniversary,
  type PersonFields,
  type PersonFormErrors,
  type PersonFormValues,
} from './person-form';

type PersonFormProps = {
  initial: PersonFormValues;
  /** Ẩn ô Thứ tự con khi không có ý nghĩa (ví dụ thêm vợ/chồng). */
  showBirthOrder?: boolean;
  /** Cây gia phả: để tìm & chọn Người phụ trách cúng giỗ, và cảnh báo khi tên trùng với Người đã có (không chặn lưu). */
  graph?: FamilyGraph<Person> | undefined;
  /** Người đang sửa (nếu có), để gợi ý mặc định con/cháu của người này làm người phụ trách cúng giỗ. */
  currentPersonId?: string;
  /** Nội dung riêng của từng thao tác (chọn mẹ, loại cha/mẹ…), đặt trên nút lưu. */
  extra?: ReactNode;
  submitLabel: string;
  /** Trạng thái của thao tác lưu (một mutation của React Query): đang lưu và lỗi từ server. */
  mutation: { isPending: boolean; error: { message: string } | null };
  onSubmit: (fields: PersonFields) => void;
  /** Nút phụ "lưu rồi nhập người kế tiếp" cho việc nhập liền nhiều người (anh chị em…). Không truyền thì ẩn nút. */
  submitAndAddLabel?: string;
  onSubmitAndAdd?: (fields: PersonFields) => void;
  onCancel: () => void;
};

const GENDER_OPTIONS = [
  ['nam', 'Nam'],
  ['nu', 'Nữ'],
  ['', 'Chưa rõ'],
] as const;

export const PersonForm = ({
  initial,
  showBirthOrder = true,
  graph,
  currentPersonId,
  extra,
  submitLabel,
  mutation,
  onSubmit,
  submitAndAddLabel,
  onSubmitAndAdd,
  onCancel,
}: PersonFormProps) => {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<PersonFormErrors>({});
  // Người đang sửa không tính là "trùng" với chính mình.
  const duplicates = graph ? findDuplicates(values.fullName, graph.persons.filter((other) => other.id !== currentPersonId)) : [];
  // Form mới chỉ mở phần cơ bản; sửa người đã có nhiều thông tin thì mở sẵn.
  const [showMore, setShowMore] = useState(initial !== undefined && hasDetails(initial));

  const set = <Key extends keyof PersonFormValues>(key: Key, value: PersonFormValues[Key]) =>
    setValues((current) => ({ ...current, [key]: value }));

  /** Ô nhập của một trường chữ tự do (nhãn, hướng dẫn, ô nhiều dòng đều lấy từ `profile-fields.ts`). */
  const field = (def: ProfileTextField) =>
    'multiline' in def && def.multiline ? (
      <TextAreaField
        key={def.key}
        label={fieldLabel(def.key, 'form')}
        rows={6}
        maxLength={20000}
        value={values[def.key]}
        onChange={(event) => set(def.key, event.target.value)}
      />
    ) : (
      <TextField
        key={def.key}
        label={fieldLabel(def.key, 'form')}
        hint={'hint' in def ? def.hint : undefined}
        value={values[def.key]}
        error={errors[def.key]}
        onChange={(event) => set(def.key, event.target.value)}
      />
    );

  const suggestion = suggestedAnniversary(values.death);

  /** Kiểm tra form; lỗi thì báo và đưa con trỏ về ô lỗi đầu tiên. */
  const validate = (form: HTMLFormElement): PersonFields | null => {
    const result = parsePersonForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      focusFirstInvalid(form);
      return null;
    }
    setErrors({});
    return result.fields;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const fields = validate(event.currentTarget as HTMLFormElement);
    if (fields) onSubmit(fields);
  };

  const submitAndAdd = (event: MouseEvent<HTMLButtonElement>) => {
    const fields = event.currentTarget.form ? validate(event.currentTarget.form) : null;
    if (fields) onSubmitAndAdd?.(fields);
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <TextField
        label="Họ và tên"
        autoFocus
        required
        maxLength={200}
        value={values.fullName}
        error={errors.fullName}
        onChange={(event) => set('fullName', event.target.value)}
      />
      {duplicates.length > 0 && (
        <p role="alert" className="rounded-xl bg-kim-soft px-4 py-3 font-medium">
          ⚠ Gia phả đã có {duplicates.length === 1 ? 'người' : `${duplicates.length} người`} tên này:{' '}
          {duplicates.map((person) => person.full_name + (person.birth_year ? ` (sinh ${person.birth_year})` : '')).join(', ')}
          . Kiểm tra lại trước khi lưu để tránh thêm trùng.
        </p>
      )}

      <fieldset>
        <legend className="mb-1 font-medium">Giới tính</legend>
        <div className="flex flex-wrap gap-2">
          {GENDER_OPTIONS.map(([value, label]) => (
            <ChoiceChip key={value} name="gender" checked={values.gender === value} onChange={() => set('gender', value)}>
              {label}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>

      {/* Quan hệ (mẹ/cha của con, ruột/nuôi) đặt ngay đầu để không bị khuất dưới form dài. */}
      {extra}

      <PartialDateField label="Ngày sinh" value={values.birth} error={errors.birth} onChange={(birth) => set('birth', birth)} />

      {showBirthOrder && (
        <TextField
          label="Thứ tự con"
          hint="1 là con trưởng. Để trống thì xếp sau các anh chị em đã có."
          value={values.birthOrder}
          error={errors.birthOrder}
          onChange={(event) => set('birthOrder', event.target.value)}
        />
      )}

      <label className="flex min-h-12 items-center gap-3 font-medium">
        <input type="checkbox" className="size-5 accent-son" checked={values.isDeceased} onChange={(event) => set('isDeceased', event.target.checked)} />
        Đã mất
      </label>

      {values.isDeceased && (
        <section className="space-y-4 rounded-2xl bg-paper p-4">
          <h3 className="font-serif text-lg font-bold">Mất & thờ cúng</h3>
          <PartialDateField label="Ngày mất" value={values.death} error={errors.death} onChange={(death) => set('death', death)} />

          <div className="space-y-2">
            <p className="font-medium">Ngày giỗ (âm lịch)</p>
            {!values.anniversaryManual && (
              <p className="text-ink-muted">
                {suggestion
                  ? `Tự tính từ ngày mất: ngày ${suggestion.day} tháng ${suggestion.month}.`
                  : 'Chưa tính được — cần đủ ngày mất. Bạn có thể ghi tay nếu nhớ ngày giỗ.'}
              </p>
            )}
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                className="size-5 accent-son"
                checked={values.anniversaryManual}
                onChange={(event) => {
                  set('anniversaryManual', event.target.checked);
                  if (event.target.checked && suggestion && !values.anniversaryDay) {
                    set('anniversaryDay', String(suggestion.day));
                    set('anniversaryMonth', String(suggestion.month));
                  }
                }}
              />
              Ghi tay ngày giỗ (theo cách họ mình vẫn làm)
            </label>
            {values.anniversaryManual && (
              <div className="grid max-w-xs grid-cols-2 gap-2">
                <TextField
                  label="Ngày"
                  inputMode="numeric"
                  value={values.anniversaryDay}
                  error={errors.anniversaryDay}
                  onChange={(event) => set('anniversaryDay', event.target.value)}
                />
                <TextField label="Tháng" inputMode="numeric" value={values.anniversaryMonth} onChange={(event) => set('anniversaryMonth', event.target.value)} />
              </div>
            )}
          </div>

          {formFields('death').map(field)}
          <WorshipKeeperField
            graph={graph}
            currentPersonId={currentPersonId}
            value={values.worshipKeeperId}
            onChange={(id) => set('worshipKeeperId', id)}
          />
        </section>
      )}

      <button type="button" className="font-semibold text-son underline" onClick={() => setShowMore((current) => !current)}>
        {showMore ? 'Ẩn thông tin thêm' : 'Thêm thông tin: tên khác, quê quán, nghề nghiệp, tiểu sử…'}
      </button>

      {showMore && (
        <div className="space-y-4">
          <section className="space-y-4">
            <h3 className="font-serif text-lg font-bold">Tên gọi khác</h3>
            {formFields('names').map(field)}
          </section>
          <section className="space-y-4">
            <h3 className="font-serif text-lg font-bold">Đời sống</h3>
            {formFields('life').map(field)}
          </section>
        </div>
      )}


      {Object.keys(errors).length > 0 && <ErrorBanner>Còn ô chưa hợp lệ, hãy xem các dòng báo đỏ.</ErrorBanner>}
      {mutation.error && <ErrorBanner>{mutation.error.message}</ErrorBanner>}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap gap-3 border-t border-line bg-surface px-4 py-3 sm:-mx-6 sm:justify-end sm:px-6">
        <Button variant="secondary" className="flex-1 sm:flex-none" onClick={onCancel}>
          Huỷ
        </Button>
        {onSubmitAndAdd && submitAndAddLabel && (
          <Button variant="secondary" className="order-last basis-full sm:order-none sm:basis-auto" disabled={mutation.isPending} onClick={submitAndAdd}>
            {submitAndAddLabel}
          </Button>
        )}
        <Button type="submit" className="flex-1 sm:flex-none" disabled={mutation.isPending}>
          {mutation.isPending ? 'Đang lưu…' : submitLabel}
        </Button>
      </div>
    </form>
  );
};

type WorshipKeeperFieldProps = {
  graph: FamilyGraph<Person> | undefined;
  currentPersonId: string | undefined;
  value: string | null;
  onChange: (personId: string | null) => void;
};

/** Tìm & chọn Người phụ trách cúng giỗ: gõ tên (có dấu hay không đều được) mới hiện kết quả, không liệt kê sẵn ai. */
const WorshipKeeperField = ({ graph, currentPersonId, value, onChange }: WorshipKeeperFieldProps) => {
  const excluded = useMemo(() => (currentPersonId ? new Set([currentPersonId]) : undefined), [currentPersonId]);
  if (!graph) return null;

  if (value) {
    return (
      <div>
        <label className="mb-1 block font-medium">Người phụ trách cúng giỗ</label>
        <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4">
          <span>{graph.person(value) ? personLabel(graph, value) : 'Người đã bị xoá'}</span>
          <button type="button" className="font-semibold text-son" onClick={() => onChange(null)}>
            Bỏ chọn
          </button>
        </div>
      </div>
    );
  }

  return <PersonPicker graph={graph} label="Người phụ trách cúng giỗ" onPick={onChange} {...(excluded ? { exclude: excluded } : {})} />;
};

/** Các ô của phần "Thêm thông tin" (tên khác, đời sống). Có ô nào đã điền thì mở sẵn phần đó khi sửa. */
const DETAIL_KEYS = TEXT_FIELDS.filter((field) => field.group !== 'death').map((field) => field.key);

const hasDetails = (values: PersonFormValues): boolean => DETAIL_KEYS.some((key) => values[key].trim() !== '');
