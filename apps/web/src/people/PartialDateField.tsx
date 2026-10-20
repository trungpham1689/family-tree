import { formatPartialDate, toOtherCalendar } from '@gia-pha/lunar';
import { useId } from 'react';
import { ChoiceChip } from '../ui/ChoiceChip';
import { Select } from '../ui/fields';
import { parseDateInput, type DateInput, type Precision } from './partial-date-input';

const PRECISIONS: [Precision, string][] = [
  ['nam', 'Chỉ năm'],
  ['thang', 'Tháng và năm'],
  ['ngay', 'Đủ ngày'],
];

const INPUT = 'min-h-12 w-full rounded-xl border border-line bg-surface px-3 tabular-nums';

/** Một phần của ngày (ngày/tháng/năm): nhãn nhìn thấy được, báo lỗi chung của cả cụm. */
const DatePart = ({
  label,
  value,
  error,
  errorId,
  className = '',
  onChange,
}: {
  label: string;
  value: string;
  error: string | undefined;
  errorId: string;
  className?: string;
  onChange: (value: string) => void;
}) => (
  <label className={className}>
    <span className="mb-0.5 block text-sm text-ink-muted">{label}</span>
    <input
      inputMode="numeric"
      className={INPUT}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

type Props = { label: string; value: DateInput; error?: string | undefined; onChange: (value: DateInput) => void };

/** Ô nhập Ngày không đầy đủ: chọn lịch, độ chính xác, cờ nhuận và "khoảng". */
export const PartialDateField = ({ label, value, error, onChange }: Props) => {
  const id = useId();
  const set = <Key extends keyof DateInput>(key: Key, next: DateInput[Key]) => onChange({ ...value, [key]: next });
  const parsed = parseDateInput(value);
  const converted = parsed && typeof parsed !== 'string' ? toOtherCalendar(parsed) : null;

  return (
    <fieldset className="space-y-3 rounded-2xl border border-line p-4" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="px-1 font-medium">{label}</legend>

      <div className="flex flex-wrap gap-2">
        {(['duong', 'am'] as const).map((calendar) => (
          <ChoiceChip
            key={calendar}
            name={`${id}-calendar`}
            compact
            className="flex-1 justify-center sm:flex-none"
            checked={value.calendar === calendar}
            onChange={() => onChange({ ...value, calendar, leap: calendar === 'am' && value.leap })}
          >
            {calendar === 'duong' ? 'Dương lịch' : 'Âm lịch'}
          </ChoiceChip>
        ))}
        <Select
          aria-label="Độ chính xác"
          className="min-h-11 w-full sm:w-auto"
          value={value.precision}
          onChange={(event) => set('precision', PRECISIONS.find(([key]) => key === event.target.value)?.[0] ?? 'nam')}
        >
          {PRECISIONS.map(([key, text]) => (
            <option key={key} value={key}>
              {text}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-3 items-end gap-2">
        {value.precision === 'ngay' && (
          <DatePart label="Ngày" value={value.day} error={error} onChange={(day) => set('day', day)} errorId={`${id}-error`} />
        )}
        {value.precision !== 'nam' && (
          <DatePart label="Tháng" value={value.month} error={error} onChange={(month) => set('month', month)} errorId={`${id}-error`} />
        )}
        <DatePart
          label="Năm"
          value={value.year}
          error={error}
          errorId={`${id}-error`}
          className={value.precision === 'nam' ? 'col-span-3 max-w-40' : ''}
          onChange={(year) => set('year', year)}
        />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {value.calendar === 'am' && value.precision !== 'nam' && (
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="size-5 accent-son" checked={value.leap} onChange={(event) => set('leap', event.target.checked)} />
            Tháng nhuận
          </label>
        )}
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            className="size-5 accent-son"
            checked={value.approximate}
            onChange={(event) => set('approximate', event.target.checked)}
          />
          Khoảng (không chắc chắn)
        </label>
      </div>

      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : (
        converted && (
          <p className="text-sm text-ink-muted">
            Tức là {formatPartialDate({ ...converted, approximate: false })}
            {converted.calendar === 'am' ? '' : ' dương lịch'}
          </p>
        )
      )}
    </fieldset>
  );
};
