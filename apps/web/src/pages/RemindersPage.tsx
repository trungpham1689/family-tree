import { Link } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { todayInVietnam } from '../calendar/month-grid';
import { OccurrenceList } from '../calendar/OccurrenceList';
import {
  useDueReminders,
  useMarkNotificationsRead,
  useMyTrees,
  useReminderPrefs,
  useReminderWatch,
  useSetReminderOffset,
  useToggleWatch,
} from '../data/tree-queries';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { ErrorBanner, Select } from '../ui/fields';

const OFFSET_OPTIONS: { value: 0 | 1 | 3 | 7; label: string }[] = [
  { value: 0, label: 'Đúng ngày' },
  { value: 1, label: 'Trước 1 ngày' },
  { value: 3, label: 'Trước 3 ngày' },
  { value: 7, label: 'Trước 7 ngày' },
];

/** Nhắc nhở của tài khoản: giỗ/sinh nhật/sự kiện đến hạn, Danh sách nhắc giỗ, độ sớm nhắc mỗi gia phả. */
export const RemindersPage = () => {
  const { state } = useAuth();
  const email = state.status === 'signed-in' ? state.session.user.email : undefined;
  const today = todayInVietnam();
  const reminders = useDueReminders();
  const watch = useReminderWatch();
  const toggleWatch = useToggleWatch();
  const trees = useMyTrees();
  const prefs = useReminderPrefs();
  const setOffset = useSetReminderOffset();
  const markRead = useMarkNotificationsRead();

  const manyTrees = trees.data && trees.data.length > 1;

  return (
    <>
      <AppHeader email={email} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-serif text-3xl font-bold text-son">Nhắc nhở</h1>

        <section className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-xl font-bold">Đến hạn</h2>
            {reminders.unread.length > 0 && (
              <Button
                variant="ghost"
                disabled={markRead.isPending}
                onClick={() => markRead.mutate(reminders.unread.map((item) => item.key))}
              >
                Đánh dấu đã xem
              </Button>
            )}
          </div>
          {reminders.isPending && <p className="mt-2 text-ink-muted">Đang tải…</p>}
          {!reminders.isPending && reminders.due.length === 0 && (
            <p className="mt-2 rounded-2xl border border-dashed border-line bg-surface px-6 py-8 text-center text-ink-muted">
              Chưa có giỗ, sinh nhật hay sự kiện nào đến hạn.
            </p>
          )}
          {reminders.due.length > 0 && (
            <div className="mt-3">
              <OccurrenceList occurrences={reminders.due.map((item) => item.occurrence)} showDate today={today} showTree={manyTrees} />
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-xl font-bold">Danh sách nhắc giỗ</h2>
          <p className="mt-1 text-ink-muted">
            Chỉ Người trong danh sách này được nhắc giỗ (sinh nhật và sự kiện luôn nhắc). Thêm/bỏ từ trang của mỗi Người.
          </p>
          {watch.isError && <ErrorBanner>{watch.error.message}</ErrorBanner>}
          {watch.isSuccess && watch.data.length === 0 && <p className="mt-2 text-ink-muted">Chưa theo dõi ai.</p>}
          {watch.isSuccess && watch.data.length > 0 && (
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {watch.data.map((item) => (
                <li key={item.personId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <Link to={`/gia-pha/${item.treeId}/nguoi/${item.personId}`} className="font-semibold hover:text-son hover:underline">
                    {item.personName}
                    {manyTrees && <span className="ml-2 text-sm font-normal text-ink-muted">{item.treeName}</span>}
                  </Link>
                  <button
                    type="button"
                    className="text-sm text-danger hover:underline"
                    disabled={toggleWatch.remove.isPending}
                    onClick={() => toggleWatch.remove.mutate(item.personId)}
                  >
                    Bỏ khỏi danh sách
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {trees.data && trees.data.length > 0 && (
          <section className="mt-8">
            <h2 className="font-serif text-xl font-bold">Độ sớm nhắc</h2>
            <p className="mt-1 text-ink-muted">Nhắc trước mấy ngày, riêng cho từng Gia phả.</p>
            <ul className="mt-3 space-y-2">
              {trees.data.map((tree) => (
                <li key={tree.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2">
                  <span className="font-medium">{tree.name}</span>
                  <Select
                    aria-label={`Độ sớm nhắc cho ${tree.name}`}
                    value={prefs.data?.get(tree.id) ?? 0}
                    disabled={setOffset.isPending}
                    onChange={(event) =>
                      setOffset.mutate({ treeId: tree.id, offsetDays: Number(event.target.value) as 0 | 1 | 3 | 7 })
                    }
                  >
                    {OFFSET_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </li>
              ))}
            </ul>
            {setOffset.isError && <ErrorBanner>{setOffset.error.message}</ErrorBanner>}
          </section>
        )}
      </main>
    </>
  );
};
