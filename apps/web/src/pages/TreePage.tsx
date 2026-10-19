import { canEditTree, isTreeOwner } from '../data/permissions';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ROLE_LABELS } from '../data/role-labels';
import {
  useAddChild,
  useAvatarDataUrl,
  useCreatePerson,
  useDeleteTree,
  useFamily,
  usePersonAvatars,
  useRemoveTreePhoto,
  useRenameTree,
  useSetTreePhoto,
  useTree,
} from '../data/tree-queries';
import type { BackupProgress } from '../backup/download-backup';
import { ImagePicker } from '../people/PersonPhotos';
import type { Person, TreeWithRole } from '../data/trees';
import { lifespanText, nameInitial } from '../people/person-display';
import type { FamilyGraph, GenerationGroup } from '../family/family-graph';
import { kindLabel } from '../family/labels';
import { EMPTY_PERSON_FORM } from '../people/person-form';
import { toIsoDate, todayInVietnam } from '../calendar/month-grid';
import { downloadFamily } from '../excel/xlsx-io';
import { LinkPerson } from '../people/LinkPerson';
import { TreeStats } from '../family/TreeStats';
import { MembersPanel } from '../tree/MembersPanel';
import { PublicLinkPanel } from '../tree/PublicLinkPanel';
import { TreeTabs } from '../tree/TreeTabs';
import { PersonForm } from '../people/PersonForm';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ErrorBanner, TextAreaField, TextField } from '../ui/fields';
import { Footer } from '../ui/Footer';
import { FullPageMessage } from '../ui/FullPageMessage';

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

const GenerationList = ({ treeId, graph, canEdit }: { treeId: string; graph: FamilyGraph<Person>; canEdit: boolean }) => {
  const generations = graph.generations();
  const unconnected = graph.unconnected();
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const linking = linkingId ? graph.person(linkingId) : undefined;
  // Mặc định Đời 1; nếu chọn một đời rồi mất đi (gia phả đổi) thì quay lại Đời 1.
  const [selectedGeneration, setSelectedGeneration] = useState<number | null>(null);
  const activeGeneration =
    selectedGeneration !== null && generations.some((group) => group.generation === selectedGeneration)
      ? selectedGeneration
      : (generations[0]?.generation ?? null);
  const activeGroup = generations.find((group) => group.generation === activeGeneration);

  return (
    <div className="space-y-8">
      {generations.length > 0 && (
        <section aria-labelledby="cac-doi">
          <h2 id="cac-doi" className="font-serif text-2xl font-bold">
            Các đời
          </h2>
          <div className="mt-3 flex items-start gap-4">
            <nav aria-label="Chọn đời" className="flex w-20 shrink-0 flex-col gap-2 sm:w-28">
              {generations.map((group) => (
                <GenerationTab
                  key={group.generation}
                  group={group}
                  active={group.generation === activeGeneration}
                  onSelect={() => setSelectedGeneration(group.generation)}
                />
              ))}
            </nav>
            <div className="min-w-0 flex-1">
              {activeGroup && <GenerationCards treeId={treeId} graph={graph} group={activeGroup} canEdit={canEdit} />}
            </div>
          </div>
        </section>
      )}
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
  <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
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

const GenerationTab = ({ group, active, onSelect }: { group: GenerationGroup<Person>; active: boolean; onSelect: () => void }) => (
  <button
    type="button"
    aria-current={active || undefined}
    onClick={onSelect}
    className={`rounded-xl px-2 py-2 text-center transition-colors ${
      active ? 'bg-son text-white' : 'bg-surface text-ink-muted hover:bg-paper'
    }`}
  >
    <p className={`text-xs font-semibold uppercase tracking-wide ${active ? 'text-white/80' : 'text-ink-muted'}`}>Đời thứ</p>
    <p className="font-serif text-2xl font-bold">{group.generation}</p>
    <p className={`text-xs ${active ? 'text-white/85' : 'text-ink-muted'}`}>
      ♂{group.male} ♀{group.female}
    </p>
    <p className={`text-xs ${active ? 'text-white/70' : 'text-ink-muted'}`}>Tổng {group.total}</p>
  </button>
);

const GenerationCards = ({
  treeId,
  graph,
  group,
  canEdit,
}: {
  treeId: string;
  graph: FamilyGraph<Person>;
  group: GenerationGroup<Person>;
  canEdit: boolean;
}) => {
  const avatars = usePersonAvatars(group.persons, true);
  return (
    <ul className="space-y-3">
      {group.persons.map((person) => (
        <GenerationCard
          key={person.id}
          treeId={treeId}
          graph={graph}
          person={person}
          canEdit={canEdit}
          avatarUrl={avatars.data?.get(person.id)}
        />
      ))}
    </ul>
  );
};

const GenerationCard = ({
  treeId,
  graph,
  person,
  canEdit,
  avatarUrl,
}: {
  treeId: string;
  graph: FamilyGraph<Person>;
  person: Person;
  canEdit: boolean;
  avatarUrl: string | undefined;
}) => {
  const { kind } = graph.placement(person.id);
  const parents = graph.parentsOf(person.id);
  const primaryParent = parents[0];
  const adopted = parents.some((parent) => parent.kind === 'nuoi');
  const spouseCount = graph.spousesOf(person.id).length;
  const childCount = graph.childrenOf(person.id).length;
  const [adding, setAdding] = useState(false);
  const addChild = useAddChild(treeId);
  const initial = nameInitial(person.full_name);

  return (
    <li>
      {primaryParent && (
        <p className="mb-1 pl-1 text-sm text-ink-muted">
          {primaryParent.person.gender === 'nu' ? 'Mẹ' : 'Cha'} {primaryParent.person.full_name}
        </p>
      )}
      <div className="flex items-stretch overflow-hidden rounded-2xl bg-son text-white">
        <Link to={`/gia-pha/${treeId}/nguoi/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-son-strong">
          <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-paper text-lg font-bold text-son">
            {avatarUrl ? <img src={avatarUrl} alt="" className="size-full object-cover" /> : initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold">{person.full_name}</span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  person.gender === 'nam' ? 'bg-kim-soft text-ink' : person.gender === 'nu' ? 'bg-white text-son' : 'border border-white/40 text-white/90'
                }`}
              >
                {person.gender === 'nam' ? '♂ Nam' : person.gender === 'nu' ? '♀ Nữ' : 'Chưa rõ giới tính'}
              </span>
              {kind !== 'dinh' && (
                <span className="rounded-full border border-white/50 px-2.5 py-0.5 text-xs font-semibold text-white">
                  {kindLabel(kind, person.gender)}
                </span>
              )}
              {adopted && <span className="rounded-full border border-white/50 px-2.5 py-0.5 text-xs font-semibold text-white">Con nuôi</span>}
            </span>
            {(spouseCount > 0 || childCount > 0) && (
              <span className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm font-semibold text-kim-soft">
                {spouseCount > 0 && <span>{spouseCount} vợ/chồng</span>}
                {spouseCount > 0 && childCount > 0 && <span aria-hidden="true">·</span>}
                {childCount > 0 && <span>{childCount} con</span>}
              </span>
            )}
          </span>
        </Link>
        {canEdit && (
          <button
            type="button"
            aria-label={`Thêm con cho ${person.full_name}`}
            onClick={() => setAdding(true)}
            className="grid w-12 shrink-0 place-items-center border-l border-white/15 text-xl font-bold hover:bg-son-strong"
          >
            +
          </button>
        )}
      </div>
      <Dialog open={adding} title={`Thêm con cho ${person.full_name}`} onClose={() => setAdding(false)}>
        {adding && (
          <PersonForm
            initial={EMPTY_PERSON_FORM}
            graph={graph}
            currentPersonId={person.id}
            submitLabel="Thêm"
            busy={addChild.isPending}
            serverError={addChild.isError ? addChild.error.message : null}
            onCancel={() => setAdding(false)}
            onSubmit={(fields) =>
              addChild.mutate(
                { parentId: person.id, otherParentId: null, kind: 'ruot', fields },
                { onSuccess: () => setAdding(false) },
              )
            }
          />
        )}
      </Dialog>
    </li>
  );
};

/** Tải một file .zip chứa toàn bộ dữ liệu và ảnh của gia phả để lưu trên máy. */
const BackupButton = ({ tree }: { tree: TreeWithRole }) => {
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const label = !progress
    ? `Tải tất cả dữ liệu của ${tree.name}`
    : progress.stage === 'images' && progress.total
      ? `Đang tải ảnh ${progress.done}/${progress.total}…`
      : progress.stage === 'zip'
        ? 'Đang đóng gói…'
        : 'Đang tải dữ liệu…';

  const run = async () => {
    setMessage(null);
    setProgress({ stage: 'data' });
    try {
      const { downloadFullBackup } = await import('../backup/download-backup');
      const failed = await downloadFullBackup(tree, toIsoDate(todayInVietnam()), setProgress);
      setMessage(
        failed === 0
          ? { tone: 'ok', text: 'Đã tải file sao lưu (.zip) về máy.' }
          : { tone: 'error', text: `Đã tải file sao lưu, nhưng ${failed} ảnh không tải được (xem HUONG-DAN.txt trong file).` },
      );
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Không tạo được file sao lưu. Hãy thử lại.' });
    } finally {
      setProgress(null);
    }
  };

  return (
    <>
      <Button variant="secondary" disabled={progress !== null} onClick={run}>
        {label}
      </Button>
      {message?.tone === 'error' && <ErrorBanner>{message.text}</ErrorBanner>}
      {message?.tone === 'ok' && <p role="status" className="basis-full text-sm text-ink-muted">{message.text}</p>}
    </>
  );
};

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
  const [description, setDescription] = useState(tree.description ?? '');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    rename.mutate({ name: name.trim(), description: description.trim() || null }, { onSuccess: onDone });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField label="Tên" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
      <TextAreaField
        label="Lời giới thiệu"
        rows={4}
        maxLength={2000}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <TreePhotoField tree={tree} />
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

/** Ảnh đại diện cả gia phả (hiện đầu Phả ký). Lưu ngay khi tải lên, không chờ nút Lưu của form. */
const TreePhotoField = ({ tree }: { tree: TreeWithRole }) => {
  const image = useAvatarDataUrl(tree.photo_path);
  const setPhoto = useSetTreePhoto();
  const removePhoto = useRemoveTreePhoto();

  return (
    <div>
      <span className="block font-medium">Ảnh gia phả</span>
      {image.data && <img src={image.data} alt="" className="mt-2 max-h-48 rounded-xl border border-line object-cover" />}
      <div className="mt-2 flex flex-wrap items-start gap-3">
        <ImagePicker
          kind="tree"
          label={tree.photo_path ? 'Đổi ảnh' : 'Tải ảnh lên'}
          pending={setPhoto.isPending}
          error={setPhoto.error?.message ?? removePhoto.error?.message}
          onPick={(file) => setPhoto.mutate({ treeId: tree.id, file, previousPath: tree.photo_path })}
        />
        {tree.photo_path && (
          <Button variant="ghost" className="text-danger!" disabled={removePhoto.isPending} onClick={() => removePhoto.mutate({ treeId: tree.id, path: tree.photo_path! })}>
            Xoá ảnh
          </Button>
        )}
      </div>
    </div>
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
