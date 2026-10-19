import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { searchPersons } from '../tree/tree-search';
import { Button } from '../ui/Button';
import { ErrorBanner, TextAreaField, TextField } from '../ui/fields';
import { findDuplicates, type DuplicateCandidate } from './duplicate-check';
import { personLabel } from './person-label';
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
  /** Người đã có trong gia phả, để cảnh báo khi tên trùng (không chặn lưu). */
  existing?: readonly DuplicateCandidate[];
  /** Để tìm & chọn Người phụ trách cúng giỗ. */
  graph?: FamilyGraph<Person>;
  /** Người đang sửa (nếu có), để gợi ý mặc định con/cháu của người này làm người phụ trách cúng giỗ. */
  currentPersonId?: string;
  /** Nội dung riêng của từng thao tác (chọn mẹ, loại cha/mẹ…), đặt trên nút lưu. */
  extra?: ReactNode;
  submitLabel: string;
  busy: boolean;
  serverError: string | null;
  onSubmit: (fields: PersonFields) => void;
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
  existing,
  graph,
  currentPersonId,
  extra,
  submitLabel,
  busy,
  serverError,
  onSubmit,
  onCancel,
}: PersonFormProps) => {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<PersonFormErrors>({});
  const duplicates = existing ? findDuplicates(values.fullName, existing) : [];
  // Form mới chỉ mở phần cơ bản; sửa người đã có nhiều thông tin thì mở sẵn.
  const [showMore, setShowMore] = useState(initial !== undefined && hasDetails(initial));

  const set = <Key extends keyof PersonFormValues>(key: Key, value: PersonFormValues[Key]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const field = (
    key: Exclude<keyof PersonFormValues, 'birth' | 'death' | 'isDeceased' | 'anniversaryManual' | 'gender' | 'worshipKeeperId'>,
    label: string,
    hint?: string,
  ) => <TextField label={label} hint={hint} value={values[key]} error={errors[key]} onChange={(event) => set(key, event.target.value)} />;

  const suggestion = suggestedAnniversary(values.death);

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
            <label
              key={value}
              className={`flex min-h-12 cursor-pointer items-center rounded-xl border px-4 ${
                values.gender === value ? 'border-son bg-son/5 font-semibold text-son' : 'border-line'
              }`}
            >
              <input type="radio" name="gender" className="sr-only" checked={values.gender === value} onChange={() => set('gender', value)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Quan hệ (mẹ/cha của con, ruột/nuôi) đặt ngay đầu để không bị khuất dưới form dài. */}
      {extra}

      <PartialDateField label="Ngày sinh" value={values.birth} error={errors.birth} onChange={(birth) => set('birth', birth)} />

      {showBirthOrder && field('birthOrder', 'Thứ tự con', '1 là con trưởng. Để trống thì xếp sau các anh chị em đã có.')}

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

          {field('burialPlace', 'Nơi an táng (mộ phần)')}
          {field('burialMapUrl', 'Link vị trí mộ', 'Mở Google Maps tại vị trí mộ → Chia sẻ → Sao chép đường link rồi dán vào đây.')}
          {field('worshipPlace', 'Nơi thờ')}
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
            {field('commonName', 'Tên thường gọi')}
            {field('courtesyName', 'Tên tự / tên hiệu')}
          </section>
          <section className="space-y-4">
            <h3 className="font-serif text-lg font-bold">Đời sống</h3>
            {field('birthPlace', 'Nơi sinh')}
            {field('hometown', 'Quê quán')}
            {field('residence', 'Nơi ở')}
            {field('occupation', 'Nghề nghiệp')}
            {field('education', 'Học vấn')}
            {field('title', 'Chức vụ / danh hiệu')}
            {field('roleNote', 'Ghi chú vai vế', 'Ví dụ: Trưởng chi 2, Trưởng tộc')}
            {field('phone', 'Số điện thoại')}
            {field('email', 'Email')}
            <TextAreaField label="Tiểu sử" rows={6} maxLength={20000} value={values.biography} onChange={(event) => set('biography', event.target.value)} />
          </section>
        </div>
      )}


      {Object.keys(errors).length > 0 && <ErrorBanner>Còn ô chưa hợp lệ, hãy xem các dòng báo đỏ.</ErrorBanner>}
      {serverError && <ErrorBanner>{serverError}</ErrorBanner>}

      <div className="sticky bottom-0 -mx-6 flex justify-end gap-3 border-t border-line bg-surface px-6 py-3">
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

type WorshipKeeperFieldProps = {
  graph: FamilyGraph<Person> | undefined;
  currentPersonId: string | undefined;
  value: string | null;
  onChange: (personId: string | null) => void;
};

/** Tìm & chọn Người phụ trách cúng giỗ; gợi ý mặc định con/cháu của người đang sửa. */
const WorshipKeeperField = ({ graph, currentPersonId, value, onChange }: WorshipKeeperFieldProps) => {
  const [query, setQuery] = useState('');

  const defaults = useMemo(() => {
    if (!graph || !currentPersonId) return [];
    const children = graph.childrenOf(currentPersonId).map(({ person }) => person);
    const grandchildren = children.flatMap(({ id }) => graph.childrenOf(id).map(({ person }) => person));
    const seen = new Set<string>([currentPersonId]);
    return [...children, ...grandchildren].filter((person) => !seen.has(person.id) && seen.add(person.id));
  }, [graph, currentPersonId]);

  const candidates = graph ? graph.persons.filter((person) => person.id !== currentPersonId) : [];
  const results = query.trim() !== '' ? searchPersons(candidates, query, 8) : defaults;

  if (value) {
    const selected = graph?.person(value);
    return (
      <div>
        <label className="mb-1 block font-medium">Người phụ trách cúng giỗ</label>
        <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4">
          <span>{selected && graph ? personLabel(graph, value) : 'Người đã bị xoá'}</span>
          <button type="button" className="font-semibold text-son" onClick={() => onChange(null)}>
            Bỏ chọn
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TextField
        label="Người phụ trách cúng giỗ"
        placeholder="Gõ tên để tìm, có dấu hay không đều được"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line">
          {results.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                className="flex min-h-12 w-full items-center px-4 text-left hover:bg-paper"
                onClick={() => {
                  onChange(person.id);
                  setQuery('');
                }}
              >
                {person.full_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() === '' && results.length === 0 && <p className="mt-1 text-sm text-ink-muted">Gõ tên để tìm người trong gia phả.</p>}
    </div>
  );
};

const DETAIL_KEYS = [
  'commonName',
  'tabooName',
  'courtesyName',
  'hanName',
  'birthPlace',
  'hometown',
  'residence',
  'occupation',
  'education',
  'title',
  'phone',
  'email',
  'biography',
  'roleNote',
] as const;

const hasDetails = (values: PersonFormValues): boolean => DETAIL_KEYS.some((key) => values[key].trim() !== '');
