import { canEditTree, isTreeOwner } from '../data/permissions';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ROLE_LABELS } from '../data/role-labels';
import { useCreatePerson, useFamily, useTree } from '../data/tree-queries';
import type { TreeWithRole } from '../data/trees';
import { EMPTY_PERSON_FORM } from '../people/person-form';
import { TreeStats } from '../family/TreeStats';
import { MembersPanel } from '../tree/MembersPanel';
import { PublicLinkPanel } from '../tree/PublicLinkPanel';
import { TreeTabs } from '../tree/TreeTabs';
import { PersonForm } from '../people/PersonForm';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ErrorBanner } from '../ui/fields';
import { Footer } from '../ui/Footer';
import { FullPageMessage } from '../ui/FullPageMessage';
import { GenerationList } from '../family/GenerationList';
import { BackupButton, ExportButton, RenameForm, DeleteForm } from '../tree/TreeActions';

export const TreePage = () => {
  const { treeId = '' } = useParams();
  const tree = useTree(treeId);

  if (tree.isPending) return <FullPageMessage>Đang tải…</FullPageMessage>;
  if (tree.isError) {
    return (
      <>
        <AppHeader />
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
      <AppHeader />
      <TreeTabs treeId={tree.data.id} />
      <TreeView tree={tree.data} />
    </>
  );
};

const TreeView = ({ tree }: { tree: TreeWithRole }) => {
  const family = useFamily(tree.id);
  const createPerson = useCreatePerson(tree.id);
  // 'root' = Thuỷ tổ của gia phả trống; 'loose' = người thuộc họ nhưng chưa biết cha/mẹ.
  const [adding, setAdding] = useState<'none' | 'root' | 'loose'>('none');
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canEdit = canEditTree(tree.role);
  const isOwner = isTreeOwner(tree.role);

  const closeAddDialog = () => {
    createPerson.reset();
    setAdding('none');
  };
  const isEmpty = family.isSuccess && family.data.persons.length === 0;

  return (
    <>
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
          <div className="flex flex-wrap gap-2">
            {canEdit && family.isSuccess && !isEmpty && <ExportButton tree={tree} graph={family.data} />}
            {isOwner && (
              <>
                <Button variant="secondary" onClick={() => setRenaming(true)}>
                  Sửa thông tin
                </Button>
                <Button variant="ghost" className="text-danger!" onClick={() => setDeleting(true)}>
                  Xoá
                </Button>
              </>
            )}
          </div>
        </div>
        {isOwner && family.isSuccess && !isEmpty && (
          <p className="mt-2 text-sm text-ink-muted">
            Nên bấm “Tải tất cả dữ liệu” ở cuối trang (dữ liệu + ảnh) định kỳ để giữ bản sao lưu trên máy — phần mềm chưa có thùng rác để khôi phục.
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
        {family.isSuccess && !isEmpty && (
          <div className="mb-8">
            <TreeStats graph={family.data} />
          </div>
        )}
        {canEdit && (
          <div className="mb-8 space-y-6">
            {isOwner && <PublicLinkPanel tree={tree} />}
            <MembersPanel tree={tree} />
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
        {isOwner && family.isSuccess && !isEmpty && (
          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
            <BackupButton tree={tree} />
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
            existing={family.data?.persons}
            graph={family.data}
            submitLabel="Thêm"
            busy={createPerson.isPending}
            serverError={createPerson.isError ? createPerson.error.message : null}
            onCancel={closeAddDialog}
            onSubmit={(fields) => createPerson.mutate(fields, { onSuccess: closeAddDialog })}
          />
        )}
      </Dialog>

      <Dialog open={renaming} title="Sửa thông tin gia phả" onClose={() => setRenaming(false)}>
        {renaming && <RenameForm tree={tree} onDone={() => setRenaming(false)} />}
      </Dialog>

      <Dialog open={deleting} title="Xoá gia phả" onClose={() => setDeleting(false)}>
        {deleting && <DeleteForm tree={tree} onCancel={() => setDeleting(false)} />}
      </Dialog>
    </main>
    <Footer />
    </>
  );
};
