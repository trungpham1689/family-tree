import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Occurrence } from '@gia-pha/reminders';
import { occurrencesInMonth, todayInVietnam } from '../calendar/month-grid';
import { OccurrenceSection } from '../calendar/OccurrenceSection';
import { useCreateTree, useMyCalendar, useMyTrees } from '../data/tree-queries';
import { ROLE_LABELS } from '../data/role-labels';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ErrorBanner, TextAreaField, TextField } from '../ui/fields';
import { Footer } from '../ui/Footer';

export const MyTreesPage = () => {
  const trees = useMyTrees();
  const [creating, setCreating] = useState(false);
  const today = todayInVietnam();
  const calendar = useMyCalendar(true);
  const monthByTree = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const occurrence of calendar.data ? occurrencesInMonth(calendar.data, today.year, today.month) : []) {
      map.set(occurrence.treeId, [...(map.get(occurrence.treeId) ?? []), occurrence]);
    }
    return map;
  }, [calendar.data, today.year, today.month]);

  return (
    <>
      <AppHeader />
      <main id="main" tabIndex={-1} className="focus:outline-none mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-serif text-3xl font-bold">Gia phả của tôi</h1>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/gia-pha/nhap-excel"
              className="inline-flex min-h-12 items-center rounded-xl border border-line bg-surface px-5 font-semibold hover:bg-paper"
            >
              Nhập từ Excel
            </Link>
            <Button onClick={() => setCreating(true)}>+ Tạo gia phả</Button>
          </div>
        </div>

        {trees.isSuccess && trees.data.length > 0 && (
          <div className="mt-8">
            <h2 className="font-serif text-2xl font-bold">Sự kiện trong tháng {today.month}/{today.year}</h2>
            {/* Ở đầu trang nên chỉ liệt kê Gia phả có sự kiện; không gia phả nào có thì một dòng báo chung. */}
            <div className="mt-4 space-y-6">
              {trees.data
                .filter((tree) => monthByTree.has(tree.id))
                .map((tree) => (
                  <OccurrenceSection
                    key={tree.id}
                    // Chỉ một gia phả thì không cần nhắc lại tên ngay dưới tiêu đề "Sự kiện trong tháng".
                    title={trees.data.length > 1 ? tree.name : ''}
                    occurrences={monthByTree.get(tree.id) ?? []}
                    today={today}
                    emptyText=""
                  />
                ))}
              {calendar.isSuccess && monthByTree.size === 0 && (
                <p className="rounded-2xl border border-dashed border-line bg-surface px-6 py-6 text-center text-ink-muted">
                  Tháng này chưa có giỗ, sinh nhật hay sự kiện nào.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-8">
          {trees.isPending && <p className="text-ink-muted">Đang tải…</p>}
          {trees.isError && <ErrorBanner>{trees.error.message}</ErrorBanner>}
          {trees.isSuccess && trees.data.length === 0 && (
            <section className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
              <p className="text-lg">Bạn chưa có gia phả nào.</p>
              <p className="mt-2 text-ink-muted">Tạo gia phả cho dòng họ, hoặc nhờ người thân mời bạn vào gia phả của họ.</p>
              <Button className="mt-6" onClick={() => setCreating(true)}>
                Tạo gia phả đầu tiên
              </Button>
            </section>
          )}
          {trees.isSuccess && trees.data.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2">
              {trees.data.map((tree) => (
                <li key={tree.id}>
                  <Link
                    to={`/gia-pha/${tree.id}`}
                    className="block h-full rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-kim"
                  >
                    <h2 className="font-serif text-xl font-bold text-son">{tree.name}</h2>
                    {tree.description && <p className="mt-1 line-clamp-2 text-ink-muted">{tree.description}</p>}
                    <p className="mt-3 text-sm text-ink-muted">
                      {ROLE_LABELS[tree.role]}{tree.personCount === undefined ? '' : ` · ${tree.personCount} người`} · tạo ngày {new Date(tree.created_at).toLocaleDateString('vi-VN')}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

      </main>
      <Footer />

      <Dialog open={creating} title="Tạo gia phả" onClose={() => setCreating(false)}>
        <CreateTreeForm onDone={() => setCreating(false)} />
      </Dialog>
    </>
  );
};

const CreateTreeForm = ({ onDone }: { onDone: () => void }) => {
  const createTree = useCreateTree();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    createTree.mutate(
      { name: name.trim(), description: description.trim() || null },
      // Mở luôn gia phả vừa tạo: việc tiếp theo gần như luôn là thêm Thuỷ tổ.
      { onSuccess: (tree) => navigate(`/gia-pha/${tree.id}`) },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField
        label="Tên gia phả"
        required
        maxLength={120}
        placeholder="Ví dụ: Gia phả họ Phạm làng Đông"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <TextAreaField
        label="Mô tả (không bắt buộc)"
        maxLength={2000}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      {createTree.isError && <ErrorBanner>{createTree.error.message}</ErrorBanner>}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" disabled={createTree.isPending || !name.trim()}>
          {createTree.isPending ? 'Đang tạo…' : 'Tạo gia phả'}
        </Button>
      </div>
    </form>
  );
};
