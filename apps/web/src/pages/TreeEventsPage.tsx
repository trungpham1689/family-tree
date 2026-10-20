import { canEditEvent, canEditTree } from '../data/permissions';
import { useAccountId } from '../data/query-keys';
import { REMINDER_OFFSETS, type ReminderOffset } from '../data/reminders';
import type { CalendarSource, Occurrence } from '@gia-pha/reminders';
import { useEffect, useId, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams, useSearchParams } from 'react-router';
import type { TreeEvent } from '../data/calendar';
import { EventSearchPanel, type EventSearchInitial } from '../events/EventSearchPanel';
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
  EMPTY_EVENT_FORM,
  eventToFormValues,
  parseEventForm,
  REPEAT_LABELS,
  type EventFormErrors,
  type EventFormValues,
  type EventRepeat,
} from '../events/event-form';
import { saveEventWithPhotos } from '../events/save-event';
import { TreeTabs } from '../tree/TreeTabs';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { ChoiceChip } from '../ui/ChoiceChip';
import { Dialog } from '../ui/Dialog';
import { ErrorBanner, Select, TextAreaField, TextField } from '../ui/fields';
import { focusFirstInvalid } from '../ui/focus-first-invalid';
import { Footer } from '../ui/Footer';
import { FullPageMessage } from '../ui/FullPageMessage';

const OFFSET_OPTIONS = REMINDER_OFFSETS.map((value) => ({ value, label: value === 0 ? 'Đúng ngày' : `Trước ${value} ngày` }));

/**
 * Giỗ, sinh nhật, kỷ niệm cưới, Sự kiện chỉ của một Gia phả — lọc ra từ "Lịch của tôi" đã tải sẵn. Luôn có `source` khi đã tải xong
 * (dù gia phả chưa có gì trong dữ liệu lịch), để trang không bao giờ trống trơn mà không nói gì.
 */
const useTreeCalendarSource = (treeId: string, treeName: string | undefined) => {
  const calendar = useMyCalendar(true);
  const source = useMemo<CalendarSource | undefined>(() => {
    const data = calendar.data;
    if (!data || treeName === undefined) return undefined;
    return {
      trees: [{ id: treeId, name: treeName }],
      persons: data.persons.filter((person) => person.tree_id === treeId),
      events: data.events.filter((event) => event.tree_id === treeId),
      marriages: (data.marriages ?? []).filter((marriage) => marriage.tree_id === treeId),
    };
  }, [calendar.data, treeId, treeName]);
  return { source, loading: calendar.isPending, error: calendar.isError ? calendar.error.message : null };
};

/**
 * Sự kiện của một Gia phả: một bộ lọc/tìm kiếm duy nhất (mặc định 30 ngày tới, gồm giỗ, sinh nhật, kỷ niệm cưới và sự kiện),
 * mỗi sự kiện có Sửa/Xoá ngay trên dòng. Ai có vai trò cũng xem; Biên tập viên tạo, sửa, xoá sự kiện của mình.
 * `?xem={id sự kiện}` mở sẵn bộ lọc về năm và tên của sự kiện đó (đích của liên kết từ Dòng thời gian, Lịch).
 */
export const TreeEventsPage = () => {
  const { treeId = '' } = useParams();
  const [params] = useSearchParams();
  const watched = params.get('xem');
  const tree = useTree(treeId);
  const events = useTreeEvents(treeId);
  const family = useFamily(treeId);
  const eventPhotos = useEventPhotos(treeId);
  const [editing, setEditing] = useState<TreeEvent | 'new' | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Sau khi lưu sự kiện: bộ lọc nhảy tới năm và tên của nó để thấy ngay kết quả. */
  const [focus, setFocus] = useState<(EventSearchInitial & { n: number }) | null>(null);

  const { source, loading, error: calendarError } = useTreeCalendarSource(treeId, tree.data?.name);
  const prefs = useReminderPrefs();
  const pref = prefs.data?.get(treeId);
  const setOffset = useSetReminderOffset();
  const setEmailEnabled = useSetEmailEnabled();
  const setTienThuong = useSetTienThuong();
  const accountId = useAccountId();

  const initial = useMemo<EventSearchInitial | undefined>(() => {
    if (focus) return focus;
    const event = watched ? events.data?.find((item) => item.id === watched) : undefined;
    return event ? { from: `${event.year ?? new Date().getFullYear()}-01-01`, to: `${event.year ?? new Date().getFullYear()}-12-31`, query: event.title } : undefined;
  }, [watched, events.data, focus]);

  if (tree.isPending) return <FullPageMessage>Đang tải…</FullPageMessage>;
  const canEdit = canEditTree(tree.data?.role);
  const role = tree.data?.role;
  const eventById = new Map((events.data ?? []).map((event) => [event.id, event]));
  const photosOf = (eventId: string) => (eventPhotos.data ?? []).filter((photo) => photo.event_id === eventId);

  const eventOf = (occurrence: Occurrence): TreeEvent | undefined => (occurrence.eventId ? eventById.get(occurrence.eventId) : undefined);

  return (
    <>
      <AppHeader />
      <TreeTabs treeId={treeId} />
      <main id="main" tabIndex={-1} className="focus:outline-none mx-auto w-full max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-3xl font-bold text-son">Sự kiện</h1>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && <Button onClick={() => setEditing('new')}>+ Thêm sự kiện</Button>}
            <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
              Cài đặt
            </Button>
          </div>
        </div>

        {tree.isError && <ErrorBanner>{tree.error.message}</ErrorBanner>}
        {events.isError && <ErrorBanner>{events.error.message}</ErrorBanner>}

        {/* Chờ danh sách sự kiện khi vào bằng ?xem= để bộ lọc mở sẵn đúng năm và tên. */}
        {(!watched || events.isSuccess) && (
          <EventSearchPanel
            key={focus ? `luu-${focus.n}` : initial ? `xem-${watched}` : 'mac-dinh'}
            source={source}
            loading={loading}
            error={calendarError}
            initial={initial}
            extra={(occurrence) => {
              const event = eventOf(occurrence);
              return event ? <EventExtras event={event} graph={family.data} photos={photosOf(event.id)} /> : null;
            }}
            actions={(occurrence) => {
              const event = eventOf(occurrence);
              return event && canEditEvent(role, accountId, event) ? (
                <EventActions treeId={treeId} event={event} photoCount={photosOf(event.id).length} onEdit={() => setEditing(event)} />
              ) : null;
            }}
          />
        )}

        <Dialog open={settingsOpen} title="Cài đặt" onClose={() => setSettingsOpen(false)}>
          <section aria-label="Thông báo">
            <h2 className="font-serif text-xl font-bold">Thông báo</h2>

          <p className="mt-1 text-ink-muted">
            Thông báo trước mấy ngày trên chuông thông báo. Email tổng hợp gửi chung cho Chủ sở hữu và Biên tập viên mỗi 5 ngày nếu có giỗ, sinh nhật hay sự kiện sắp tới; bật/tắt email ở đây.
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
              aria-label="Thông báo trước"
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
        </Dialog>

        <Dialog open={editing !== null} title={editing === 'new' ? 'Thêm sự kiện' : 'Sửa sự kiện'} onClose={() => setEditing(null)}>
          {editing !== null && (
            <EventForm
              treeId={treeId}
              event={editing === 'new' ? null : editing}
              graph={family.data}
              photos={editing === 'new' ? [] : photosOf(editing.id)}
              onDone={(saved) => {
                if (saved?.year) setFocus({ from: `${saved.year}-01-01`, to: `${saved.year}-12-31`, query: saved.title, n: (focus?.n ?? 0) + 1 });
                setEditing(null);
              }}
            />
          )}
        </Dialog>
      </main>
      <Footer />
    </>
  );
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

/** Dưới dòng của một sự kiện: mô tả, người chủ trì, nơi hiển thị và ảnh. */
const EventExtras = ({ event, graph, photos }: { event: TreeEvent; graph: FamilyGraph<Person> | undefined; photos: readonly EventPhoto[] }) => {
  // Chỉ tải file ảnh của những sự kiện đang hiện trong danh sách.
  const images = useEventPhotoImages(photos).data;
  const host = hostName(graph, event.host_person_id);
  return (
    <>
      {host && (
        <span className="block text-sm">
          Chủ trì: <strong>{host}</strong>
        </span>
      )}
      {event.note && <span className="mt-1 block whitespace-pre-line">{event.note}</span>}
      {(event.show_in_pha_ky || event.show_in_timeline) && (
        <span className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-son">
          {event.show_in_pha_ky && <span className="rounded-full bg-son/10 px-2 py-0.5">Có trong Phả ký</span>}
          {event.show_in_timeline && <span className="rounded-full bg-son/10 px-2 py-0.5">Có trong Dòng thời gian</span>}
        </span>
      )}
      {event.year === null && <span className="block text-sm text-danger">Chưa có năm: bấm Sửa để thêm.</span>}
      <PhotoStrip photos={photos} images={images} />
    </>
  );
};

/** Sửa / Xoá (có xác nhận) của một sự kiện, ngay trên dòng kết quả. */
const EventActions = ({ treeId, event, photoCount, onEdit }: { treeId: string; event: TreeEvent; photoCount: number; onEdit: () => void }) => {
  const remove = useRemoveTreeEvent(treeId);
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl bg-danger-soft px-3 py-2">
        <span className="text-danger">
          Xoá sự kiện “{event.title}”{photoCount > 0 ? ` và ${photoCount} ảnh` : ''}?
        </span>
        <Button variant="secondary" onClick={() => setConfirming(false)}>
          Huỷ
        </Button>
        <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate(event.id)}>
          Xoá
        </Button>
        {remove.isError && <ErrorBanner>{remove.error.message}</ErrorBanner>}
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <Button variant="ghost" onClick={onEdit}>
        Sửa
      </Button>
      <Button variant="ghost" className="text-danger!" onClick={() => setConfirming(true)}>
        Xoá
      </Button>
    </div>
  );
};

const EventForm = ({
  treeId,
  event,
  graph,
  photos,
  onDone,
}: {
  treeId: string;
  event: TreeEvent | null;
  graph: FamilyGraph<Person> | undefined;
  photos: readonly EventPhoto[];
  onDone: (saved?: { title: string; year: number | null }) => void;
}) => {
  const group = useId();
  const images = useEventPhotoImages(photos).data;
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
  const [saveError, setSaveError] = useState<string | null>(null);
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
    if (busy) return; // đang lưu: bỏ qua lần gửi thêm (Enter, bấm liên tiếp)
    const form = formEvent.currentTarget as HTMLFormElement;
    const result = parseEventForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      focusFirstInvalid(form);
      return;
    }
    setErrors({});
    setSaveError(null);
    setUploadError(null);
    setBusy(true);
    try {
      const outcome = await saveEventWithPhotos(
        {
          saveEvent: (eventId, fields) => save.mutateAsync({ treeId, eventId, fields }),
          uploadPhoto: (eventId, file) => upload.mutateAsync({ treeId, eventId, file }).then(() => undefined),
        },
        { eventId: savedId, fields: result.fields, files: pending },
      );
      if (outcome.status === 'event-failed') return setSaveError(outcome.error);
      setSavedId(outcome.eventId);
      if (outcome.status === 'saved') {
        setPending([]);
        onDone({ title: result.fields.title, year: result.fields.year });
        return;
      }
      // Sự kiện đã lưu; ảnh chưa tải được giữ lại để bấm Lưu thử lại.
      setPending(outcome.remaining);
      setUploadError(outcome.error);
    } finally {
      setBusy(false);
    }
  };

  const choice = <Value extends string | boolean>(name: string, current: Value, value: Value, label: string, onPick: (value: Value) => void) => (
    <ChoiceChip key={String(value)} name={`${group}-${name}`} checked={current === value} onChange={() => onPick(value)}>
      {label}
    </ChoiceChip>
  );

  const monthly = values.repeat === 'monthly';
  const once = values.repeat === 'once';
  const host = hostName(graph, values.hostPersonId);

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField label="Tên sự kiện" required value={values.title} error={errors.title} onChange={(e) => set('title', e.target.value)} />
      <fieldset>
        <legend className="mb-1 font-medium">
          Lịch
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {choice('calendar', values.calendar, 'am', 'Âm lịch', (value) => set('calendar', value))}
          {choice('calendar', values.calendar, 'duong', 'Dương lịch', (value) => set('calendar', value))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1 font-medium">
          Lặp lại
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {(['once', 'monthly', 'yearly'] as EventRepeat[]).map((repeat) => choice('repeat', values.repeat, repeat, REPEAT_LABELS[repeat], (value) => set('repeat', value)))}
        </div>
      </fieldset>
      <div className="grid grid-cols-3 gap-3">
        <TextField label="Ngày" required inputMode="numeric" value={values.day} error={errors.day} onChange={(e) => set('day', e.target.value)} />
        {!monthly && <TextField label="Tháng" required inputMode="numeric" value={values.month} error={errors.month} onChange={(e) => set('month', e.target.value)} />}
        <TextField
          label={once ? 'Năm' : 'Từ năm'}
          required
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
                className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/60 text-white before:absolute before:-inset-2 before:content-['']"
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
                className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/60 text-white before:absolute before:-inset-2 before:content-['']"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        {room > 0 && (
          <label className="mt-2 inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-control px-4 font-semibold hover:bg-paper has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus">
            + Thêm ảnh
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pickFiles} />
          </label>
        )}
        {photoError && <ErrorBanner>{photoError}</ErrorBanner>}
        {removePhoto.isError && <ErrorBanner>{removePhoto.error.message}</ErrorBanner>}
      </div>

      {saveError && <ErrorBanner>{saveError}</ErrorBanner>}
      {uploadError && <ErrorBanner>Sự kiện đã lưu nhưng chưa tải hết ảnh: {uploadError}</ErrorBanner>}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => onDone()}>
          Huỷ
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Đang lưu…' : 'Lưu'}
        </Button>
      </div>
    </form>
  );
};
