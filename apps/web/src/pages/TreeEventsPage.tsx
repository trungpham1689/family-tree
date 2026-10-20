import { canEditEvent, canEditTree } from '../data/permissions';
import { useAccountId } from '../data/query-keys';
import { REMINDER_OFFSETS, type ReminderOffset } from '../data/reminders';
import { fromJulianDay, julianDay } from '@gia-pha/lunar';
import { occurrencesBetween, upcoming, type CalendarSource } from '@gia-pha/reminders';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { OccurrenceSection } from '../calendar/OccurrenceSection';
import { todayInVietnam } from '../calendar/month-grid';
import type { TreeEvent } from '../data/calendar';
import { EventSearchPanel } from '../events/EventSearchPanel';
import { checkImageFile, MAX_PHOTOS_PER_EVENT, PHOTO_SPECS, type EventPhoto } from '../data/photos';
import { personLabel } from '../people/person-label';
import { PersonPicker } from '../people/PersonPicker';
import type { FamilyGraph } from '../family/family-graph';
import type { Person } from '../data/trees';
import {
  useMyCalendar,
  useRemoveTreeEvent,
  useReminderPrefs,
  useSaveTreeEvent,
  useSetEmailEnabled,
  useSetReminderOffset,
  useSetTienThuong,
  useFamily,
  useTree,
  useTreeEvents,
} from '../data/tree-queries';
import { useEventPhotoImages, useEventPhotos, useRemoveEventPhoto, useUploadEventPhoto } from '../data/calendar-queries';
import {
  describeEvent,
  EMPTY_EVENT_FORM,
  eventToFormValues,
  parseEventForm,
  REPEAT_LABELS,
  type EventFormErrors,
  type EventFormValues,
  type EventRepeat,
} from '../events/event-form';
import { TreeTabs } from '../tree/TreeTabs';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ErrorBanner, Select, TextAreaField, TextField } from '../ui/fields';
import { Footer } from '../ui/Footer';
import { FullPageMessage } from '../ui/FullPageMessage';

const OFFSET_OPTIONS = REMINDER_OFFSETS.map((value) => ({ value, label: value === 0 ? 'Đúng ngày' : `Trước ${value} ngày` }));

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
  const family = useFamily(treeId);
  const eventPhotos = useEventPhotos(treeId);
  const photoImages = useEventPhotoImages(eventPhotos.data ?? []);
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
  const accountId = useAccountId();

  if (tree.isPending) return <FullPageMessage>Đang tải…</FullPageMessage>;
  const canEdit = canEditTree(tree.data?.role);
  const role = tree.data?.role;

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

        <EventSearchPanel source={source} />

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
              onChange={(event) => setOffset.mutate({ treeId, offsetDays: Number(event.target.value) as ReminderOffset })}
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
          Họp họ, ngày lễ của dòng họ… Một lần, hằng tháng hoặc hằng năm (âm hay dương lịch), có mô tả, người chủ trì và tối đa {MAX_PHOTOS_PER_EVENT} ảnh;
          chọn đưa vào Phả ký và Dòng thời gian hay không. Giỗ và sinh nhật tự có trên lịch từ hồ sơ từng người, không cần thêm ở đây.
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
              <EventRow
                key={event.id}
                treeId={treeId}
                event={event}
                graph={family.data}
                photos={(eventPhotos.data ?? []).filter((photo) => photo.event_id === event.id)}
                images={photoImages.data}
                canEdit={canEditEvent(role, accountId, event)}
                onEdit={() => setEditing(event)}
              />
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
              graph={family.data}
              photos={editing === 'new' ? [] : (eventPhotos.data ?? []).filter((photo) => photo.event_id === editing.id)}
              images={photoImages.data}
              onDone={() => setEditing(null)}
            />
          )}
        </Dialog>
      </main>
      <Footer />
    </>
  );
};

/** "Lần tới: 12/3/2027" theo đúng lịch của sự kiện (âm hay dương, một lần, hằng tháng, hằng năm); null khi không còn lần nào. */
const nextDateText = (event: TreeEvent): string | null => {
  const today = todayInVietnam();
  const [next] = occurrencesBetween({ trees: [], persons: [], events: [event] }, today, fromJulianDay(julianDay(today) + 800));
  return next ? `Lần tới: ${next.date.day}/${next.date.month}/${next.date.year}` : null;
};

type Images = Map<string, string> | undefined;

const PhotoStrip = ({ photos, images }: { photos: readonly EventPhoto[]; images: Images }) =>
  photos.length === 0 ? null : (
    <ul className="mt-2 flex flex-wrap gap-2" aria-label="Ảnh sự kiện">
      {photos.map((photo) => {
        const src = images?.get(photo.id);
        return (
          <li key={photo.id} className="size-20 overflow-hidden rounded-lg border border-line bg-paper">
            {src && <img src={src} alt="" className="size-full object-cover" />}
          </li>
        );
      })}
    </ul>
  );

const hostName = (graph: FamilyGraph<Person> | undefined, hostId: string | null) =>
  hostId && graph?.person(hostId) ? personLabel(graph, hostId) : null;

const EventRow = ({
  treeId,
  event,
  graph,
  photos,
  images,
  canEdit,
  onEdit,
}: {
  treeId: string;
  event: TreeEvent;
  graph: FamilyGraph<Person> | undefined;
  photos: readonly EventPhoto[];
  images: Images;
  canEdit: boolean;
  onEdit: () => void;
}) => {
  const remove = useRemoveTreeEvent(treeId);
  const [confirming, setConfirming] = useState(false);
  const host = hostName(graph, event.host_person_id);
  return (
    <li id={event.id} className="space-y-2 px-5 py-4 target:bg-kim-soft/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold">{event.title}</p>
          <p className="text-ink-muted">{describeEvent(event)}</p>
          {nextDateText(event) && <p className="text-sm text-son">{nextDateText(event)}</p>}
          {event.year === null && <p className="text-sm text-danger">Chưa có năm: bấm Sửa để thêm, sự kiện mới tìm lại và đưa vào Dòng thời gian được.</p>}
          {host && <p className="text-sm">Chủ trì: <strong>{host}</strong></p>}
          {event.note && <p className="mt-1 whitespace-pre-line">{event.note}</p>}
          {(event.show_in_pha_ky || event.show_in_timeline) && (
            <p className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-son">
              {event.show_in_pha_ky && <span className="rounded-full bg-son/10 px-2 py-0.5">Có trong Phả ký</span>}
              {event.show_in_timeline && <span className="rounded-full bg-son/10 px-2 py-0.5">Có trong Dòng thời gian</span>}
            </p>
          )}
          <PhotoStrip photos={photos} images={images} />
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
          <span className="text-danger">Xoá sự kiện “{event.title}”{photos.length > 0 ? ` và ${photos.length} ảnh` : ''}?</span>
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

const EventForm = ({
  treeId,
  event,
  graph,
  photos,
  images,
  onDone,
}: {
  treeId: string;
  event: TreeEvent | null;
  graph: FamilyGraph<Person> | undefined;
  photos: readonly EventPhoto[];
  images: Images;
  onDone: () => void;
}) => {
  const save = useSaveTreeEvent(treeId);
  const upload = useUploadEventPhoto(treeId);
  const removePhoto = useRemoveEventPhoto(treeId);
  const [values, setValues] = useState<EventFormValues>(() => (event ? eventToFormValues(event) : EMPTY_EVENT_FORM));
  const [errors, setErrors] = useState<EventFormErrors>({});
  /** Id sau lần lưu đầu: nếu tải ảnh lỗi giữa chừng, bấm Lưu lại thì cập nhật sự kiện này chứ không tạo thêm. */
  const [savedId, setSavedId] = useState<string | null>(event?.id ?? null);
  const [pending, setPending] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const set = <Key extends keyof EventFormValues>(key: Key, value: EventFormValues[Key]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const room = MAX_PHOTOS_PER_EVENT - photos.length - pending.length;
  const previews = useMemo(() => pending.map((file) => URL.createObjectURL(file)), [pending]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const pickFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    setPhotoError(null);
    const accepted: File[] = [];
    for (const file of files) {
      const problem = checkImageFile(file);
      if (problem) {
        setPhotoError(`${file.name}: ${problem}`);
        continue;
      }
      if (accepted.length >= room) {
        setPhotoError(`Mỗi sự kiện tối đa ${MAX_PHOTOS_PER_EVENT} ảnh.`);
        break;
      }
      accepted.push(file);
    }
    if (accepted.length > 0) setPending((current) => [...current, ...accepted]);
  };

  const submit = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    const result = parseEventForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setUploadError(null);
    setBusy(true);
    let eventId: string;
    try {
      eventId = await save.mutateAsync({ treeId, eventId: savedId, fields: result.fields });
    } catch {
      setBusy(false); // lỗi lưu sự kiện hiện ở `save.error`
      return;
    }
    setSavedId(eventId);
    try {
      for (const file of [...pending]) {
        await upload.mutateAsync({ treeId, eventId, file });
        setPending((current) => current.filter((item) => item !== file));
      }
      onDone();
    } catch (error) {
      // Sự kiện đã lưu; ảnh chưa tải được giữ lại để bấm Lưu thử lại.
      setUploadError((error as Error).message);
    } finally {
      setBusy(false);
    }
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

  const monthly = values.repeat === 'monthly';
  const once = values.repeat === 'once';
  const host = hostName(graph, values.hostPersonId);

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
          {(['once', 'monthly', 'yearly'] as EventRepeat[]).map((repeat) => choice(values.repeat, repeat, REPEAT_LABELS[repeat], (value) => set('repeat', value)))}
        </div>
      </fieldset>
      <div className="grid grid-cols-3 gap-3">
        <TextField label="Ngày" inputMode="numeric" value={values.day} error={errors.day} onChange={(e) => set('day', e.target.value)} />
        {!monthly && <TextField label="Tháng" inputMode="numeric" value={values.month} error={errors.month} onChange={(e) => set('month', e.target.value)} />}
        <TextField
          label={once ? 'Năm' : 'Từ năm'}
          inputMode="numeric"
          value={values.year}
          error={errors.year}
          onChange={(e) => set('year', e.target.value)}
        />
      </div>
      {values.calendar === 'am' && !monthly && (
        <label className="flex min-h-12 items-center gap-3">
          <input type="checkbox" className="size-5 accent-son" checked={values.leap} onChange={(e) => set('leap', e.target.checked)} />
          Tháng nhuận
        </label>
      )}
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <TextField label="Giờ" type="time" value={values.time} error={errors.time} onChange={(e) => set('time', e.target.value)} />
        <TextField label="Địa điểm" value={values.location} onChange={(e) => set('location', e.target.value)} />
      </div>
      <TextAreaField label="Mô tả sự kiện" value={values.note} onChange={(e) => set('note', e.target.value)} />

      <div>
        <p className="mb-1 font-medium">Người chủ trì</p>
        {host ? (
          <div className="flex flex-wrap items-center gap-3">
            <strong>{host}</strong>
            <Button variant="ghost" onClick={() => set('hostPersonId', null)}>
              Bỏ chọn
            </Button>
          </div>
        ) : graph ? (
          <PersonPicker graph={graph} label="Tìm người chủ trì (tuỳ chọn)" onPick={(personId) => set('hostPersonId', personId)} />
        ) : (
          <p className="text-ink-muted">Đang tải danh sách người…</p>
        )}
      </div>

      <fieldset className="space-y-1">
        <legend className="mb-1 font-medium">Hiển thị</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="size-5 accent-son" checked={values.showInPhaKy} onChange={(e) => set('showInPhaKy', e.target.checked)} />
          Đưa vào Phả ký
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="size-5 accent-son" checked={values.showInTimeline} onChange={(e) => set('showInTimeline', e.target.checked)} />
          Đưa vào Dòng thời gian
        </label>
      </fieldset>

      <div>
        <p className="mb-1 font-medium">
          Ảnh ({photos.length + pending.length}/{MAX_PHOTOS_PER_EVENT})
        </p>
        <p className="text-sm text-ink-muted">{PHOTO_SPECS.event.hint}</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {photos.map((photo) => (
            <li key={photo.id} className="relative size-24 overflow-hidden rounded-lg border border-line bg-paper">
              {images?.get(photo.id) && <img src={images.get(photo.id)} alt="" className="size-full object-cover" />}
              <button
                type="button"
                aria-label="Xoá ảnh"
                disabled={removePhoto.isPending}
                onClick={() => removePhoto.mutate({ photoId: photo.id, path: photo.storage_path })}
                className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/60 text-white"
              >
                ×
              </button>
            </li>
          ))}
          {pending.map((file, index) => (
            <li key={`${file.name}-${index}`} className="relative size-24 overflow-hidden rounded-lg border border-dashed border-son bg-paper">
              <img src={previews[index]} alt="" className="size-full object-cover" />
              <button
                type="button"
                aria-label="Bỏ ảnh này"
                onClick={() => setPending((current) => current.filter((item) => item !== file))}
                className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/60 text-white"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        {room > 0 && (
          <label className="mt-2 inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-line px-4 font-semibold hover:bg-paper">
            + Thêm ảnh
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pickFiles} />
          </label>
        )}
        {photoError && <ErrorBanner>{photoError}</ErrorBanner>}
        {removePhoto.isError && <ErrorBanner>{removePhoto.error.message}</ErrorBanner>}
      </div>

      {save.isError && <ErrorBanner>{save.error.message}</ErrorBanner>}
      {uploadError && <ErrorBanner>Sự kiện đã lưu nhưng chưa tải hết ảnh: {uploadError}</ErrorBanner>}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Đang lưu…' : 'Lưu'}
        </Button>
      </div>
    </form>
  );
};
