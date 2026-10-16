import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { ROLE_LABELS } from '../data/role-labels';
import { useDeleteTree, usePersons, useRenameTree, useSavePerson, useTree } from '../data/tree-queries';
import type { Person, TreeWithRole } from '../data/trees';
import { lifespanText } from '../people/person-display';
import { EMPTY_PERSON_FORM, personToFormValues } from '../people/person-form';
import { PersonForm } from '../people/PersonForm';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ErrorBanner, TextField } from '../ui/fields';
import { FullPageMessage } from '../ui/FullPageMessage';

type PersonEditor = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; person: Person };

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

const TreeView = ({ tree }: { tree: TreeWithRole }) => {
  const persons = usePersons(tree.id);
  const savePerson = useSavePerson(tree.id);
  const [editor, setEditor] = useState<PersonEditor>({ mode: 'closed' });
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canEdit = tree.role === 'owner' || tree.role === 'editor';
  const isOwner = tree.role === 'owner';

  const closeEditor = () => {
    savePerson.reset();
    setEditor({ mode: 'closed' });
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/gia-pha" className="text-ink-muted hover:text-son">
        ← Gia phả của tôi
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
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
      </header>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-serif text-2xl font-bold">Người trong gia phả</h2>
          {canEdit && persons.isSuccess && persons.data.length > 0 && (
            <Button variant="secondary" onClick={() => setEditor({ mode: 'create' })}>
              + Thêm Người
            </Button>
          )}
        </div>

        <div className="mt-4">
          {persons.isPending && <p className="text-ink-muted">Đang tải…</p>}
          {persons.isError && <ErrorBanner>{persons.error.message}</ErrorBanner>}
          {persons.isSuccess && persons.data.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center">
              <p className="text-lg">Gia phả chưa có ai.</p>
              <p className="mt-2 text-ink-muted">Bắt đầu từ Thuỷ tổ — người ở đời thứ nhất mà dòng họ còn ghi lại được.</p>
              {canEdit && (
                <Button className="mt-6" onClick={() => setEditor({ mode: 'create' })}>
                  Thêm Thuỷ tổ
                </Button>
              )}
            </div>
          )}
          {persons.isSuccess && persons.data.length > 0 && (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
              {persons.data.map((person) => (
                <li key={person.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="text-lg font-semibold">{person.full_name}</p>
                    <p className="text-ink-muted">{lifespanText(person) || 'Chưa rõ năm sinh'}</p>
                  </div>
                  {canEdit && (
                    <Button variant="ghost" onClick={() => setEditor({ mode: 'edit', person })}>
                      Sửa
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <Dialog
        open={editor.mode !== 'closed'}
        title={editor.mode === 'edit' ? `Sửa: ${editor.person.full_name}` : persons.data?.length ? 'Thêm Người' : 'Thêm Thuỷ tổ'}
        onClose={closeEditor}
      >
        {editor.mode !== 'closed' && (
          <PersonForm
            key={editor.mode === 'edit' ? editor.person.id : 'new'}
            initial={editor.mode === 'edit' ? personToFormValues(editor.person) : EMPTY_PERSON_FORM}
            submitLabel={editor.mode === 'edit' ? 'Lưu thay đổi' : 'Thêm'}
            busy={savePerson.isPending}
            serverError={savePerson.isError ? savePerson.error.message : null}
            onCancel={closeEditor}
            onSubmit={(fields) =>
              savePerson.mutate(
                { personId: editor.mode === 'edit' ? editor.person.id : null, fields },
                { onSuccess: closeEditor },
              )
            }
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
        <Button type="submit" className="bg-danger hover:bg-danger" disabled={!matches || deleteTree.isPending}>
          {deleteTree.isPending ? 'Đang xoá…' : 'Xoá vĩnh viễn'}
        </Button>
      </div>
    </form>
  );
};
