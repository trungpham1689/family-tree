import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { ROLE_LABELS } from '../data/role-labels';
import { useCreatePerson, useDeleteTree, useFamily, useRenameTree, useTree } from '../data/tree-queries';
import type { Person, TreeWithRole } from '../data/trees';
import { lifespanText } from '../people/person-display';
import type { FamilyGraph } from '../family/family-graph';
import { kindLabel } from '../family/labels';
import { EMPTY_PERSON_FORM } from '../people/person-form';
import { toIsoDate, todayInVietnam } from '../calendar/month-grid';
import { downloadFamily } from '../excel/xlsx-io';
import { LinkPerson } from '../people/LinkPerson';
import { PublicLinkPanel } from '../tree/PublicLinkPanel';
import { PersonForm } from '../people/PersonForm';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ErrorBanner, TextField } from '../ui/fields';
import { FullPageMessage } from '../ui/FullPageMessage';

export const TreePage = () => {
  const { treeId = '' } = useParams();
  const { state } = useAuth();
  const email = state.status === 'signed-in' ? state.session.user.email : undefined;
  const tree = useTree(treeId);

  if (tree.isPending) return <FullPageMessage>Đang tải…</FullPageMessage>;
  if (tree.isError) {
    return (
      <>
        <AppHeader email={email} />
        <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
          <ErrorBanner>{tree.error.message}</ErrorBanner>
          <Link to="/gia-pha" className="font-semibold text-son underline">
            ← Về danh sách gia phả
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader email={email} />
      <TreeView tree={tree.data} />
    </>
  );
};

const ACTION_BASE = 'inline-flex min-h-12 items-center rounded-xl border px-5 font-semibold';
const ACTION = `${ACTION_BASE} border-line bg-surface hover:bg-paper`;
const PRIMARY_ACTION = `${ACTION_BASE} border-son bg-son text-white hover:bg-son-strong`;

const TreeView = ({ tree }: { tree: TreeWithRole }) => {
  const family = useFamily(tree.id);
  const createPerson = useCreatePerson(tree.id);
  // 'root' = Thuỷ tổ của gia phả trống; 'loose' = người thuộc họ nhưng chưa biết cha/mẹ.
  const [adding, setAdding] = useState<'none' | 'root' | 'loose'>('none');
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canEdit = tree.role === 'owner' || tree.role === 'editor';
  const isOwner = tree.role === 'owner';

  const closeAddDialog = () => {
    createPerson.reset();
    setAdding('none');
  };
  const isEmpty = family.isSuccess && family.data.persons.length === 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/gia-pha" className="text-ink-muted hover:text-son">
        ← Gia phả của tôi
      </Link>

      <header className="mt-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-bold text-son">{tree.name}</h1>
            {tree.description && <p className="mt-1 text-ink-muted">{tree.description}</p>}
            <p className="mt-2 text-sm text-ink-muted">Vai trò của bạn: {ROLE_LABELS[tree.role]}</p>
          </div>
          {isOwner && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setRenaming(true)}>
                Đổi tên
              </Button>
              <Button variant="ghost" className="text-danger" onClick={() => setDeleting(true)}>
                Xoá
              </Button>
            </div>
          )}
        </div>
        <nav aria-label="Việc với gia phả" className="mt-5 flex flex-wrap gap-3">
          <Link to={`/gia-pha/${tree.id}/cay`} className={PRIMARY_ACTION}>
            Xem cây gia phả
          </Link>
          <Link to={`/gia-pha/${tree.id}/pha-do`} className={ACTION}>
            Phả đồ (in)
          </Link>
          <Link to={`/gia-pha/${tree.id}/su-kien`} className={ACTION}>
            Sự kiện
          </Link>
          {family.isSuccess && !isEmpty && <ExportButton tree={tree} graph={family.data} />}
        </nav>
        {canEdit && family.isSuccess && !isEmpty && (
          <p className="mt-2 text-sm text-ink-muted">
            Nên bấm “Xuất Excel” định kỳ để giữ bản sao lưu — phần mềm chưa có thùng rác để khôi phục.
          </p>
        )}
      </header>

      <section className="mt-8">
        {family.isPending && <p className="text-ink-muted">Đang tải…</p>}
        {family.isError && <ErrorBanner>{family.error.message}</ErrorBanner>}
        {isEmpty && (
          <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center">
            <p className="text-lg">Gia phả chưa có ai.</p>
            <p className="mt-2 text-ink-muted">Bắt đầu từ Thuỷ tổ — người ở đời thứ nhất mà dòng họ còn ghi lại được.</p>
            {canEdit && (
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button onClick={() => setAdding('root')}>Thêm Thuỷ tổ</Button>
                {isOwner && (
                  <Link
                    to={`/gia-pha/nhap-excel?vao=${tree.id}`}
                    className="inline-flex min-h-12 items-center rounded-xl border border-line bg-surface px-5 font-semibold hover:bg-paper"
                  >
                    Nhập từ Excel
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
        {isOwner && (
          <div className="mb-8">
            <PublicLinkPanel tree={tree} />
          </div>
        )}
        {family.isSuccess && <GenerationList treeId={tree.id} graph={family.data} canEdit={canEdit} />}
        {canEdit && family.isSuccess && !isEmpty && (
          <div className="mt-8 border-t border-line pt-6">
            <Button variant="secondary" onClick={() => setAdding('loose')}>
              + Thêm người chưa rõ cha mẹ
            </Button>
            <p className="mt-1 text-sm text-ink-muted">
              Người thuộc họ nhưng chưa biết nối vào đâu. Họ nằm ở mục “Chưa nối vào cây” cho tới khi được gắn.
            </p>
          </div>
        )}
      </section>

      <Dialog
        open={adding !== 'none'}
        title={adding === 'root' ? 'Thêm Thuỷ tổ' : 'Thêm người chưa rõ cha mẹ'}
        onClose={closeAddDialog}
      >
        {adding !== 'none' && (
          <PersonForm
            initial={EMPTY_PERSON_FORM}
            showBirthOrder={false}
            submitLabel="Thêm"
            busy={createPerson.isPending}
            serverError={createPerson.isError ? createPerson.error.message : null}
            onCancel={closeAddDialog}
            onSubmit={(fields) => createPerson.mutate(fields, { onSuccess: closeAddDialog })}
          />
        )}
      </Dialog>

      <Dialog open={renaming} title="Đổi tên gia phả" onClose={() => setRenaming(false)}>
        {renaming && <RenameForm tree={tree} onDone={() => setRenaming(false)} />}
      </Dialog>

      <Dialog open={deleting} title="Xoá gia phả" onClose={() => setDeleting(false)}>
        {deleting && <DeleteForm tree={tree} onCancel={() => setDeleting(false)} />}
      </Dialog>
    </main>
  );
};

const GenerationList = ({ treeId, graph, canEdit }: { treeId: string; graph: FamilyGraph<Person>; canEdit: boolean }) => {
  const generations = graph.generations();
  const unconnected = graph.unconnected();
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const linking = linkingId ? graph.person(linkingId) : undefined;

  return (
    <div className="space-y-8">
      {generations.map((group) => (
        <section key={group.generation} aria-labelledby={`doi-${group.generation}`}>
          <h2 id={`doi-${group.generation}`} className="flex flex-wrap items-baseline gap-x-3 font-serif text-2xl font-bold">
            Đời {group.generation}
            <span className="font-sans text-base font-normal text-ink-muted">
              {group.male} nam · {group.female} nữ · tổng {group.total}
            </span>
          </h2>
          <PersonList treeId={treeId} graph={graph} persons={group.persons} />
        </section>
      ))}
      {unconnected.length > 0 && (
        <section aria-labelledby="chua-noi">
          <h2 id="chua-noi" className="font-serif text-2xl font-bold">
            Chưa nối vào cây
            <span className="ml-3 font-sans text-base font-normal text-ink-muted">{unconnected.length} người</span>
          </h2>
          <p className="mt-1 text-ink-muted">Những người chưa xác định được cha/mẹ trong gia phả.</p>
          <PersonList
            treeId={treeId}
            graph={graph}
            persons={unconnected}
            action={
              canEdit
                ? (person) => (
                    <Button variant="ghost" onClick={() => setLinkingId(person.id)}>
                      Gắn vào cây
                    </Button>
                  )
                : undefined
            }
          />
        </section>
      )}
      <Dialog open={linking !== undefined} title={`Gắn ${linking?.full_name ?? ''} vào cây`} onClose={() => setLinkingId(null)}>
        {linking && <LinkPerson treeId={treeId} graph={graph} person={linking} onDone={() => setLinkingId(null)} />}
      </Dialog>
    </div>
  );
};

type PersonListProps = {
  treeId: string;
  graph: FamilyGraph<Person>;
  persons: Person[];
  action?: ((person: Person) => ReactNode) | undefined;
};

const PersonList = ({ treeId, graph, persons, action }: PersonListProps) => (
  <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
    {persons.map((person) => {
      const { kind } = graph.placement(person.id);
      return (
        <li key={person.id} className="flex items-center gap-2 hover:bg-paper">
          <Link
            to={`/gia-pha/${treeId}/nguoi/${person.id}`}
            className="flex flex-1 items-center justify-between gap-4 px-5 py-4"
          >
            <div>
              <p className="text-lg font-semibold">{person.full_name}</p>
              <p className="text-ink-muted">{lifespanText(person) || 'Chưa rõ năm sinh'}</p>
            </div>
            {kind !== 'dinh' && (
              <span className="rounded-full bg-paper px-3 py-1 text-sm text-ink-muted">{kindLabel(kind, person.gender)}</span>
            )}
          </Link>
          {action && <div className="pr-3">{action(person)}</div>}
        </li>
      );
    })}
  </ul>
);

const ExportButton = ({ tree, graph }: { tree: TreeWithRole; graph: FamilyGraph<Person> }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportNow = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadFamily(tree.name, graph, toIsoDate(todayInVietnam()));
    } catch {
      setError('Không tạo được file Excel. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" disabled={busy} onClick={exportNow}>
        {busy ? 'Đang tạo file…' : 'Xuất Excel'}
      </Button>
      {error && <ErrorBanner>{error}</ErrorBanner>}
    </>
  );
};

const RenameForm = ({ tree, onDone }: { tree: TreeWithRole; onDone: () => void }) => {
  const rename = useRenameTree(tree.id);
  const [name, setName] = useState(tree.name);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    rename.mutate(name.trim(), { onSuccess: onDone });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField label="Tên mới" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
      {rename.isError && <ErrorBanner>{rename.error.message}</ErrorBanner>}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" disabled={rename.isPending || !name.trim()}>
          Lưu
        </Button>
      </div>
    </form>
  );
};

const DeleteForm = ({ tree, onCancel }: { tree: TreeWithRole; onCancel: () => void }) => {
  const deleteTree = useDeleteTree(tree.id);
  const navigate = useNavigate();
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === tree.name.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!matches) return;
    deleteTree.mutate(undefined, { onSuccess: () => navigate('/gia-pha', { replace: true }) });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p>
        Toàn bộ Người và dữ liệu trong gia phả <strong>{tree.name}</strong> sẽ bị xoá vĩnh viễn và không khôi phục được.
        Nên xuất Excel để giữ bản sao trước khi xoá.
      </p>
      <TextField
        label="Gõ lại tên gia phả để xác nhận"
        value={typed}
        autoComplete="off"
        onChange={(event) => setTyped(event.target.value)}
      />
      {deleteTree.isError && <ErrorBanner>{deleteTree.error.message}</ErrorBanner>}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Huỷ
        </Button>
        <Button type="submit" variant="danger" disabled={!matches || deleteTree.isPending}>
          {deleteTree.isPending ? 'Đang xoá…' : 'Xoá vĩnh viễn'}
        </Button>
      </div>
    </form>
  );
};
