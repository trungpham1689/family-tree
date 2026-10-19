import { canEditTree } from '../data/permissions';
import { fromJulianDay, julianDay, nextAnniversary } from '@gia-pha/lunar';
import { occurrencesBetween, upcoming, type CalendarSource } from '@gia-pha/reminders';
import { useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { OccurrenceSection } from '../calendar/OccurrenceSection';
import { todayInVietnam } from '../calendar/month-grid';
import type { TreeEvent } from '../data/calendar';
import {
  useMyCalendar,
  useRemoveTreeEvent,
  useReminderPrefs,
  useSaveTreeEvent,
  useSetEmailEnabled,
  useSetReminderOffset,
  useSetTienThuong,
  useTree,
  useTreeEvents,
} from '../data/tree-queries';
import {
  describeEvent,
  EMPTY_EVENT_FORM,
  eventToFormValues,
  parseEventForm,
  type EventFormErrors,
  type EventFormValues,
} from '../events/event-form';
import { TreeTabs } from '../tree/TreeTabs';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ErrorBanner, Select, TextAreaField, TextField } from '../ui/fields';
import { Footer } from '../ui/Footer';
import { FullPageMessage } from '../ui/FullPageMessage';

const OFFSET_OPTIONS: { value: 0 | 1 | 3 | 7; label: string }[] = [
  { value: 0, label: 'Đúng ngày' },
  { value: 1, label: 'Trước 1 ngày' },
  { value: 3, label: 'Trước 3 ngày' },
  { value: 7, label: 'Trước 7 ngày' },
];

/** Giỗ, sinh nhật, Sự kiện chỉ của một Gia phả — lọc ra từ "Lịch của tôi" đã tải sẵn. */
const useTreeCalendarSource = (treeId: string): CalendarSource | undefined => {
  const calendar = useMyCalendar(true);
  return useMemo(() => {
    const data = calendar.data;
    const tree = data?.trees.find((item) => item.id === treeId);
    if (!data || !tree) return undefined;
    return {
      trees: [tree],
      persons: data.persons.filter((person) => person.tree_id === treeId),
      events: data.events.filter((event) => event.tree_id === treeId),
    };
  }, [calendar.data, treeId]);
};

/** Sự kiện của một Gia phả: họp họ, ngày tự đặt. Ai có vai trò cũng xem; Biên tập viên tạo, sửa, xoá. */
export const TreeEventsPage = () => {
  const { treeId = '' } = useParams();
  const tree = useTree(treeId);
  const events = useTreeEvents(treeId);
  const [editing, setEditing] = useState<TreeEvent | 'new' | null>(null);

  const today = todayInVietnam();
  const source = useTreeCalendarSource(treeId);
  const upcomingList = useMemo(() => (source ? upcoming(source, today, 30) : []), [source, today]);
  const pastList = useMemo(() => {
    if (!source) return [];
    const monthAgo = fromJulianDay(julianDay(today) - 30);
    return occurrencesBetween(source, monthAgo, today)
      .filter((occurrence) => julianDay(occurrence.date) < julianDay(today))
      .reverse();
  }, [source, today]);
  const prefs = useReminderPrefs();
  const pref = prefs.data?.get(treeId);
  const setOffset = useSetReminderOffset();
  const setEmailEnabled = useSetEmailEnabled();
  const setTienThuong = useSetTienThuong();

  if (tree.isPending) return <FullPageMessage>Đang tải…</FullPageMessage>;
  const canEdit = canEditTree(tree.data?.role);

  return (
    <>
      <AppHeader />
      <TreeTabs treeId={treeId} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-serif text-3xl font-bold text-son">Sự kiện</h1>

        <div className="mt-6">
          <OccurrenceSection title="Sắp tới (30 ngày)" occurrences={upcomingList} today={today} emptyText="30 ngày tới chưa có giỗ, sinh nhật hay sự kiện nào." />
        </div>

        <div className="mt-8">
          <OccurrenceSection title="Đã qua (30 ngày)" occurrences={pastList} today={today} emptyText="30 ngày qua chưa có giỗ, sinh nhật hay sự kiện nào." />
        </div>

        <section className="mt-8 rounded-xl border border-line bg-surface px-4 py-3">
          <h2 className="font-serif text-xl font-bold">Độ sớm nhắc</h2>
          <p className="mt-1 text-ink-muted">
            Nhắc trước mấy ngày trên chuông nhắc nhở. Email tổng hợp gửi chung cho Chủ sở hữu và Biên tập viên mỗi 5 ngày nếu có giỗ, sinh nhật hay sự kiện sắp tới; bật/tắt email ở đây.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-5 accent-son"
                checked={pref?.emailEnabled ?? true}
                disabled={setEmailEnabled.isPending}
                onChange={(event) => setEmailEnabled.mutate({ treeId, emailEnabled: event.target.checked })}
              />
              Email
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-5 accent-son"
                checked={pref?.tienThuong ?? false}
                disabled={setTienThuong.isPending}
                onChange={(event) => setTienThuong.mutate({ treeId, tienThuong: event.target.checked })}
              />
              Nhắc cả Tiên thường (hôm trước ngày giỗ)
            </label>
            <Select
              aria-label="Độ sớm nhắc"
              value={pref?.offsetDays ?? 0}
              disabled={setOffset.isPending}
              onChange={(event) => setOffset.mutate({ treeId, offsetDays: Number(event.target.value) as 0 | 1 | 3 | 7 })}
            >
              {OFFSET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          {(setOffset.isError || setEmailEnabled.isError || setTienThuong.isError) && (
            <ErrorBanner>{setOffset.error?.message ?? setEmailEnabled.error?.message ?? setTienThuong.error?.message}</ErrorBanner>
          )}
        </section>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-xl font-bold">Quản lý sự kiện</h2>
          {canEdit && <Button onClick={() => setEditing('new')}>+ Thêm sự kiện</Button>}
        </div>
        <p className="mt-1 text-ink-muted">
          Họp họ, ngày lễ của dòng họ… Giỗ và sinh nhật tự có trên lịch từ hồ sơ từng người, không cần thêm ở đây.
        </p>

        {tree.isError && <ErrorBanner>{tree.error.message}</ErrorBanner>}
        {events.isError && <ErrorBanner>{events.error.message}</ErrorBanner>}
        {events.isSuccess && events.data.length === 0 && (
          <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center text-ink-muted">
            Chưa có sự kiện nào.
          </p>
        )}
        {events.isSuccess && events.data.length > 0 && (
          <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {events.data.map((event) => (
              <EventRow key={event.id} treeId={treeId} event={event} canEdit={canEdit} onEdit={() => setEditing(event)} />
            ))}
          </ul>
        )}

        <Dialog
          open={editing !== null}
          title={editing === 'new' ? 'Thêm sự kiện' : 'Sửa sự kiện'}
          onClose={() => setEditing(null)}
        >
          {editing !== null && (
            <EventForm
              treeId={treeId}
              event={editing === 'new' ? null : editing}
              onDone={() => setEditing(null)}
            />
          )}
        </Dialog>
      </main>
      <Footer />
    </>
  );
};

const nextDateText = (event: TreeEvent): string | null => {
  if (event.calendar !== 'am' || !event.repeats_yearly) return null;
  const next = nextAnniversary({ day: event.day, month: event.month }, todayInVietnam());
  return `Lần tới: ${next.day}/${next.month}/${next.year}`;
};

const EventRow = ({ treeId, event, canEdit, onEdit }: { treeId: string; event: TreeEvent; canEdit: boolean; onEdit: () => void }) => {
  const remove = useRemoveTreeEvent(treeId);
  const [confirming, setConfirming] = useState(false);
  return (
    <li id={event.id} className="space-y-2 px-5 py-4 target:bg-kim-soft/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{event.title}</p>
          <p className="text-ink-muted">{describeEvent(event)}</p>
          {nextDateText(event) && <p className="text-sm text-son">{nextDateText(event)}</p>}
          {event.note && <p className="mt-1 whitespace-pre-line">{event.note}</p>}
        </div>
        {canEdit && !confirming && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onEdit}>
              Sửa
            </Button>
            <Button variant="ghost" className="text-danger!" onClick={() => setConfirming(true)}>
              Xoá
            </Button>
          </div>
        )}
      </div>
      {confirming && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-danger-soft px-4 py-3">
          <span className="text-danger">Xoá sự kiện “{event.title}”?</span>
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Huỷ
          </Button>
          <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate(event.id)}>
            Xoá
          </Button>
        </div>
      )}
      {remove.isError && <ErrorBanner>{remove.error.message}</ErrorBanner>}
    </li>
  );
};

const EventForm = ({ treeId, event, onDone }: { treeId: string; event: TreeEvent | null; onDone: () => void }) => {
  const save = useSaveTreeEvent(treeId);
  const [values, setValues] = useState<EventFormValues>(() => (event ? eventToFormValues(event) : EMPTY_EVENT_FORM));
  const [errors, setErrors] = useState<EventFormErrors>({});
  const set = <Key extends keyof EventFormValues>(key: Key, value: EventFormValues[Key]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = (formEvent: FormEvent) => {
    formEvent.preventDefault();
    const result = parseEventForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    save.mutate({ treeId, eventId: event?.id ?? null, fields: result.fields }, { onSuccess: onDone });
  };

  const choice = <Value extends string | boolean>(current: Value, value: Value, label: string, onPick: (value: Value) => void) => (
    <label
      key={String(value)}
      className={`flex min-h-12 cursor-pointer items-center rounded-xl border px-4 ${
        current === value ? 'border-son bg-son/5 font-semibold text-son' : 'border-line'
      }`}
    >
      <input type="radio" className="sr-only" checked={current === value} onChange={() => onPick(value)} />
      {label}
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField label="Tên sự kiện" value={values.title} error={errors.title} onChange={(e) => set('title', e.target.value)} />
      <fieldset>
        <legend className="mb-1 font-medium">Lịch</legend>
        <div className="flex flex-wrap gap-2">
          {choice(values.calendar, 'am', 'Âm lịch', (value) => set('calendar', value))}
          {choice(values.calendar, 'duong', 'Dương lịch', (value) => set('calendar', value))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1 font-medium">Lặp lại</legend>
        <div className="flex flex-wrap gap-2">
          {choice(values.repeatsYearly, true, 'Hằng năm', (value) => set('repeatsYearly', value))}
          {choice(values.repeatsYearly, false, 'Một lần', (value) => set('repeatsYearly', value))}
        </div>
      </fieldset>
      <div className="grid grid-cols-3 gap-3">
        <TextField label="Ngày" inputMode="numeric" value={values.day} error={errors.day} onChange={(e) => set('day', e.target.value)} />
        <TextField label="Tháng" inputMode="numeric" value={values.month} error={errors.month} onChange={(e) => set('month', e.target.value)} />
        {!values.repeatsYearly && (
          <TextField label="Năm" inputMode="numeric" value={values.year} error={errors.year} onChange={(e) => set('year', e.target.value)} />
        )}
      </div>
      {values.calendar === 'am' && (
        <label className="flex min-h-12 items-center gap-3">
          <input type="checkbox" className="size-5 accent-son" checked={values.leap} onChange={(e) => set('leap', e.target.checked)} />
          Tháng nhuận
        </label>
      )}
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <TextField label="Giờ" type="time" value={values.time} error={errors.time} onChange={(e) => set('time', e.target.value)} />
        <TextField label="Địa điểm" value={values.location} onChange={(e) => set('location', e.target.value)} />
      </div>
      <TextAreaField label="Ghi chú" value={values.note} onChange={(e) => set('note', e.target.value)} />
      {save.isError && <ErrorBanner>{save.error.message}</ErrorBanner>}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Đang lưu…' : 'Lưu'}
        </Button>
      </div>
    </form>
  );
};
