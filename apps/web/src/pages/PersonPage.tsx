import { useLayoutEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { AVATAR_MIME_TYPES, MAX_AVATAR_BYTES, type PersonPhoto } from '../data/photos';
import {
  useAddChild,
  useAddParent,
  useAddSpouse,
  useApproveDeletePerson,
  useAvatarDataUrl,
  useFamily,
  useLinkAccountToPerson,
  usePersonPhotos,
  useRejectDeletePerson,
  useRemovePhoto,
  useMutedGioPersons,
  useReorderChildren,
  useReorderUnions,
  useSetAvatarPhoto,
  useSetFoundsBranch,
  useSetHiddenFromPublic,
  useSetProgenitor,
  useToggleGioMute,
  useTree,
  useUpdateParentLinkKind,
  useUpdatePhotoCaption,
  useUpdateUnion,
  useUploadPhoto,
} from '../data/tree-queries';
import type { Person } from '../data/trees';
import type { ChildRelative, FamilyGraph, ParentLinkKind, SpouseRelative, UnionStatus } from '../family/family-graph';
import { birthOrderLabel, kindLabel, LINK_KIND_LABELS, spouseLabel, UNION_STATUS_LABELS } from '../family/labels';
import { lifespanText, nameInitial } from '../people/person-display';
import { DeletePerson } from '../people/DeletePerson';
import { EditPerson } from '../people/EditPerson';
import { EMPTY_PERSON_FORM } from '../people/person-form';
import { PersonForm } from '../people/PersonForm';
import { ProfileInfo } from '../people/ProfileInfo';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ErrorBanner, Select } from '../ui/fields';
import { Footer } from '../ui/Footer';
import { FullPageMessage } from '../ui/FullPageMessage';

type Action = 'none' | 'edit' | 'add-child' | 'add-parent' | 'add-spouse' | 'delete';

export const PersonPage = () => {
  const { treeId = '', personId = '' } = useParams();
  const { state } = useAuth();
  const accountId = state.status === 'signed-in' ? state.session.user.id : null;
  const tree = useTree(treeId);
  const family = useFamily(treeId);

  if (tree.isPending || family.isPending) return <FullPageMessage>Đang tải…</FullPageMessage>;
  const error = tree.error ?? family.error;
  const person = family.data?.person(personId);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link to={`/gia-pha/${treeId}`} className="text-ink-muted hover:text-son">
          ← {tree.data?.name ?? 'Gia phả'}
        </Link>
        {error && <ErrorBanner>{error.message}</ErrorBanner>}
        {!error && !person && <ErrorBanner>Không tìm thấy Người này. Có thể đã bị xoá.</ErrorBanner>}
        {tree.data && family.data && person && (
          <PersonDetail
            treeId={treeId}
            graph={family.data}
            person={person}
            canEdit={tree.data.role === 'owner' || tree.data.role === 'editor'}
            isOwner={tree.data.role === 'owner'}
            accountId={accountId}
            linkedPersonId={tree.data.linkedPersonId}
          />
        )}
      </main>
      <Footer />
    </>
  );
};

type DetailProps = {
  treeId: string;
  graph: FamilyGraph<Person>;
  person: Person;
  canEdit: boolean;
  isOwner: boolean;
  accountId: string | null;
  linkedPersonId: string | null;
};

const PersonDetail = ({ treeId, graph, person, canEdit, isOwner, accountId, linkedPersonId }: DetailProps) => {
  const [action, setAction] = useState<Action>('none');
  const placement = graph.placement(person.id);
  const branchRoot = placement.branchId ? graph.person(placement.branchId) : undefined;
  const parents = graph.parentsOf(person.id);
  const spouses = graph.spousesOf(person.id);
  const children = graph.childrenOf(person.id);
  const setProgenitor = useSetProgenitor(treeId);
  const setFoundsBranch = useSetFoundsBranch(treeId);
  const close = () => setAction('none');
  // Biên tập viên chỉ thêm/sửa/xoá Người do chính mình tạo; Chủ sở hữu sửa/xoá được mọi Người.
  const canEditThisPerson = isOwner || (canEdit && person.created_by === accountId);

  return (
    <article className="mt-3">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-start gap-4">
          <PersonAvatar person={person} />
          <div>
            <h1 className="font-serif text-3xl font-bold">{person.full_name}</h1>
            <p className="mt-1 text-lg text-ink-muted">{lifespanText(person) || 'Chưa rõ năm sinh'}</p>
            <dl className="mt-3 flex flex-wrap gap-2 text-sm">
              <Tag>{kindLabel(placement.kind, person.gender)}</Tag>
              {placement.generation !== null && <Tag>Đời {placement.generation}</Tag>}
              {branchRoot && <Tag>Chi {branchRoot.full_name}</Tag>}
              {person.birth_order !== null && <Tag>{birthOrderLabel(person.birth_order)}</Tag>}
            </dl>
            <ReminderControls treeId={treeId} person={person} isMe={linkedPersonId === person.id} />
          </div>
        </div>
        {canEditThisPerson && (
          <Button variant="secondary" onClick={() => setAction('edit')}>
            Sửa thông tin
          </Button>
        )}
      </header>

      {person.pending_delete_by && (
        <PendingDeleteBanner treeId={treeId} person={person} isOwner={isOwner} accountId={accountId} />
      )}

      <ProfileInfo person={person} graph={graph} />

      <PhotoGallery treeId={treeId} person={person} canEdit={canEdit} />

      <Section
        title="Cha mẹ"
        action={canEdit && <Button variant="ghost" onClick={() => setAction('add-parent')}>+ Thêm cha/mẹ</Button>}
      >
        {parents.length === 0 ? (
          <Empty>Chưa ghi cha mẹ.</Empty>
        ) : (
          parents.map(({ person: parent, kind }) => (
            <RelativeRow key={parent.id} treeId={treeId} relative={parent} caption={parent.gender === 'nu' ? 'Mẹ' : 'Cha'}>
              {canEdit ? (
                <LinkKindSelect treeId={treeId} childId={person.id} parentId={parent.id} value={kind} />
              ) : (
                kind === 'nuoi' && <Tag>Nuôi</Tag>
              )}
            </RelativeRow>
          ))
        )}
      </Section>

      <Section
        title="Vợ / chồng"
        action={canEdit && <Button variant="ghost" onClick={() => setAction('add-spouse')}>+ Thêm vợ/chồng</Button>}
      >
        {spouses.length === 0 ? (
          <Empty>Chưa ghi vợ/chồng.</Empty>
        ) : (
          <ReorderableSpouses treeId={treeId} viewerId={person.id} items={spouses} canEdit={canEdit} />
        )}
      </Section>

      <Section
        title="Con"
        action={canEdit && <Button variant="ghost" onClick={() => setAction('add-child')}>+ Thêm con</Button>}
      >
        {children.length === 0 ? (
          <Empty>Chưa ghi con.</Empty>
        ) : (
          <ReorderableChildren treeId={treeId} items={children} canEdit={canEdit} />
        )}
      </Section>

      {canEditThisPerson && !person.pending_delete_by && (
        <div className="mt-10 space-y-4 border-t border-line pt-6">
          <h2 className="font-serif text-xl font-bold">Hành động khác</h2>
          {placement.kind !== 'thuy_to' && placement.kind !== 'dau_re' && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
              <p className="text-sm text-ink-muted">Đời của mọi người sẽ được tính lại từ người này.</p>
              <Button variant="secondary" disabled={setProgenitor.isPending} onClick={() => setProgenitor.mutate(person.id)}>
                Đặt làm Thuỷ tổ
              </Button>
              {setProgenitor.isError && <ErrorBanner>{setProgenitor.error.message}</ErrorBanner>}
            </div>
          )}
          {placement.kind === 'dinh' && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
              <p className="text-sm text-ink-muted">
                {person.founds_branch
                  ? 'Người này và con cháu đang tính là một chi riêng trong Phả ký.'
                  : 'Người này và con cháu sẽ tính là một chi riêng trong Phả ký.'}
              </p>
              <Button
                variant="secondary"
                disabled={setFoundsBranch.isPending}
                onClick={() => setFoundsBranch.mutate({ personId: person.id, foundsBranch: !person.founds_branch })}
              >
                {person.founds_branch ? 'Bỏ lập chi' : 'Lập chi mới'}
              </Button>
              {setFoundsBranch.isError && <ErrorBanner>{setFoundsBranch.error.message}</ErrorBanner>}
            </div>
          )}
          <HiddenFromPublicToggle treeId={treeId} person={person} />
          <Button variant="secondary" onClick={() => setAction('delete')}>
            {isOwner ? 'Xoá người này' : 'Gửi yêu cầu xoá'}
          </Button>
        </div>
      )}

      <ActionDialogs
        treeId={treeId}
        graph={graph}
        person={person}
        isOwner={isOwner}
        spouses={spouses.map((s) => s.person)}
        action={action}
        onClose={close}
      />
    </article>
  );
};

const ActionDialogs = ({
  treeId,
  graph,
  person,
  isOwner,
  spouses,
  action,
  onClose,
}: {
  treeId: string;
  graph: FamilyGraph<Person>;
  person: Person;
  isOwner: boolean;
  spouses: Person[];
  action: Action;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const addChild = useAddChild(treeId);
  const addParent = useAddParent(treeId);
  const addSpouse = useAddSpouse(treeId);
  // null = chưa chọn: mặc định là vợ/chồng thứ nhất *tại lúc mở form* (danh sách có thể vừa thay đổi).
  const [chosenOtherParent, setOtherParentId] = useState<string | null>(null);
  const otherParentId = chosenOtherParent ?? spouses[0]?.id ?? '';
  const [linkKind, setLinkKind] = useState<ParentLinkKind>('ruot');

  const existing = graph.persons.filter((other) => other.id !== person.id);

  const finish = () => {
    for (const mutation of [addChild, addParent, addSpouse]) mutation.reset();
    setOtherParentId(null);
    setLinkKind('ruot');
    onClose();
  };

  const titles: Record<Action, string> = {
    none: '',
    edit: `Sửa: ${person.full_name}`,
    'add-child': `Thêm con của ${person.full_name}`,
    'add-parent': `Thêm cha/mẹ của ${person.full_name}`,
    'add-spouse': `Thêm vợ/chồng của ${person.full_name}`,
    delete: 'Xoá Người',
  };

  const kindPicker = (
    <fieldset>
      <legend className="mb-1 font-medium">Quan hệ</legend>
      <div className="flex gap-2">
        {(['ruot', 'nuoi'] as const).map((kind) => (
          <label
            key={kind}
            className={`flex min-h-12 cursor-pointer items-center rounded-xl border px-4 ${
              linkKind === kind ? 'border-son bg-son/5 font-semibold text-son' : 'border-line'
            }`}
          >
            <input type="radio" className="sr-only" checked={linkKind === kind} onChange={() => setLinkKind(kind)} />
            {LINK_KIND_LABELS[kind]}
          </label>
        ))}
      </div>
    </fieldset>
  );

  const otherParentPicker = spouses.length > 0 && (
    <label className="block">
      <span className="mb-1 block font-medium">{person.gender === 'nu' ? 'Cha của con' : 'Mẹ của con'}</span>
      <Select className="w-full" value={otherParentId} onChange={(event) => setOtherParentId(event.target.value)}>
        {spouses.map((spouse) => (
          <option key={spouse.id} value={spouse.id}>
            {spouse.full_name}
          </option>
        ))}
        <option value="">Không rõ / không ghi</option>
      </Select>
    </label>
  );

  return (
    <Dialog open={action !== 'none'} title={titles[action]} onClose={finish}>
      {action === 'edit' && <EditPerson treeId={treeId} person={person} graph={graph} onDone={finish} />}
      {action === 'delete' && (
        <DeletePerson
          treeId={treeId}
          graph={graph}
          person={person}
          isOwner={isOwner}
          onCancel={finish}
          onDeleted={() => (isOwner ? navigate(`/gia-pha/${treeId}`, { replace: true }) : finish())}
        />
      )}
      {action === 'add-child' && (
        <PersonForm
          initial={EMPTY_PERSON_FORM}
          existing={existing}
          graph={graph}
          extra={
            <>
              {otherParentPicker}
              {kindPicker}
            </>
          }
          submitLabel="Thêm con"
          busy={addChild.isPending}
          serverError={addChild.error?.message ?? null}
          onCancel={finish}
          onSubmit={(fields) =>
            addChild.mutate(
              { parentId: person.id, otherParentId: otherParentId || null, kind: linkKind, fields },
              { onSuccess: finish },
            )
          }
        />
      )}
      {action === 'add-parent' && (
        <PersonForm
          initial={EMPTY_PERSON_FORM}
          showBirthOrder={false}
          existing={existing}
          graph={graph}
          extra={kindPicker}
          submitLabel="Thêm"
          busy={addParent.isPending}
          serverError={addParent.error?.message ?? null}
          onCancel={finish}
          onSubmit={(fields) => addParent.mutate({ childId: person.id, kind: linkKind, fields }, { onSuccess: finish })}
        />
      )}
      {action === 'add-spouse' && (
        <PersonForm
          initial={{ ...EMPTY_PERSON_FORM, gender: person.gender === 'nam' ? 'nu' : person.gender === 'nu' ? 'nam' : '' }}
          showBirthOrder={false}
          existing={existing}
          graph={graph}
          submitLabel="Thêm"
          busy={addSpouse.isPending}
          serverError={addSpouse.error?.message ?? null}
          onCancel={finish}
          onSubmit={(fields) => addSpouse.mutate({ personId: person.id, order: null, fields }, { onSuccess: finish })}
        />
      )}
    </Dialog>
  );
};

const LinkKindSelect = ({ treeId, childId, parentId, value }: { treeId: string; childId: string; parentId: string; value: ParentLinkKind }) => {
  const update = useUpdateParentLinkKind(treeId);
  return (
    <div>
      <Select
        aria-label="Loại quan hệ"
        className="min-h-11"
        value={value}
        disabled={update.isPending}
        onChange={(event) => update.mutate({ childId, parentId, kind: event.target.value === 'nuoi' ? 'nuoi' : 'ruot' })}
      >
        <option value="ruot">Ruột</option>
        <option value="nuoi">Nuôi</option>
      </Select>
      {update.isError && <p className="mt-1 text-sm text-danger">{update.error.message}</p>}
    </div>
  );
};

const STATUS_VALUES: UnionStatus[] = ['con', 'ly_hon', 'goa'];

const UnionStatusSelect = ({
  treeId,
  viewerId,
  unionId,
  status,
}: {
  treeId: string;
  viewerId: string;
  unionId: string;
  status: UnionStatus;
}) => {
  const update = useUpdateUnion(treeId);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label="Trạng thái hôn phối"
        className="min-h-11"
        value={status}
        disabled={update.isPending}
        onChange={(event) => {
          const next = STATUS_VALUES.find((value) => value === event.target.value);
          if (next) update.mutate({ unionId, viewerId, status: next });
        }}
      >
        {STATUS_VALUES.map((value) => (
          <option key={value} value={value}>
            {UNION_STATUS_LABELS[value]}
          </option>
        ))}
      </Select>
      {update.isError && <p className="w-full text-sm text-danger">{update.error.message}</p>}
    </div>
  );
};

/** Các thông tin hồ sơ đã ghi; dòng nào trống thì không hiện. */
const HiddenFromPublicToggle = ({ treeId, person }: { treeId: string; person: Person }) => {
  const setHidden = useSetHiddenFromPublic(treeId);
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <label className="flex min-h-12 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          className="size-5 accent-son"
          checked={person.hidden_from_public}
          disabled={setHidden.isPending}
          onChange={(event) => setHidden.mutate({ personId: person.id, hidden: event.target.checked })}
        />
        <span className="font-medium">Ẩn hoàn toàn khỏi link công khai</span>
      </label>
      <p className="text-sm text-ink-muted">
        Người này không xuất hiện trên link công khai; nếu có con cháu thì hiện thành một ô “Ẩn danh”.
      </p>
      {setHidden.isError && <ErrorBanner>{setHidden.error.message}</ErrorBanner>}
    </div>
  );
};

/** Thông báo khi Người đang chờ duyệt xoá: Chủ sở hữu thấy nút duyệt/từ chối, người khác chỉ thấy trạng thái. */
const PendingDeleteBanner = ({
  treeId,
  person,
  isOwner,
  accountId,
}: {
  treeId: string;
  person: Person;
  isOwner: boolean;
  accountId: string | null;
}) => {
  const approve = useApproveDeletePerson(treeId);
  const reject = useRejectDeletePerson(treeId);

  return (
    <div className="mt-6 rounded-xl bg-kim-soft px-4 py-3">
      <p className="font-medium">
        {isOwner || person.pending_delete_by === accountId
          ? 'Đang chờ Chủ sở hữu duyệt yêu cầu xoá người này.'
          : 'Người này đang chờ duyệt xoá.'}
      </p>
      {isOwner && (
        <div className="mt-2 flex gap-2">
          <Button variant="secondary" disabled={reject.isPending} onClick={() => reject.mutate(person.id)}>
            Từ chối
          </Button>
          <Button variant="danger" disabled={approve.isPending} onClick={() => approve.mutate(person.id)}>
            Đồng ý xoá
          </Button>
        </div>
      )}
      {(approve.isError || reject.isError) && <ErrorBanner>{(approve.error ?? reject.error)?.message}</ErrorBanner>}
    </div>
  );
};

const Section = ({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) => (
  <section className="mt-8">
    <div className="flex items-center justify-between gap-4">
      <h2 className="font-serif text-xl font-bold">{title}</h2>
      {action}
    </div>
    <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{children}</ul>
  </section>
);

const RelativeRow = ({
  treeId,
  relative,
  caption,
  children,
}: {
  treeId: string;
  relative: Person;
  caption: string;
  children?: ReactNode;
}) => (
  <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
    <Link to={`/gia-pha/${treeId}/nguoi/${relative.id}`} className="group">
      {caption && <span className="block text-sm text-ink-muted">{caption}</span>}
      <span className="text-lg font-semibold group-hover:text-son group-hover:underline">{relative.full_name}</span>
      <span className="ml-2 text-ink-muted">{lifespanText(relative)}</span>
    </Link>
    {children}
  </li>
);

type DragHandleProps = {
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
};

/**
 * Kéo thả để đổi thứ tự một danh sách (con, vợ/chồng…): tính lại vị trí tối đa một lần mỗi khung
 * hình thay vì mỗi sự kiện pointermove, và trượt mượt (FLIP) khi thứ tự đổi thay vì nhảy khựng.
 */
const useDragReorder = (sourceOrder: string[], enabled: boolean, onReorder: (order: string[]) => void) => {
  const sourceKey = sourceOrder.join(',');
  // Chỉ dùng thứ tự đang kéo khi nó còn khớp dữ liệu hiện có; dữ liệu đổi (thêm/xoá, lưu xong) thì quay lại thứ tự từ server.
  const [dragState, setDragState] = useState({ key: sourceKey, order: sourceOrder });
  const order = dragState.key === sourceKey ? dragState.order : sourceOrder;
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const draggingId = useRef<string | null>(null);
  const pendingClientY = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);
  const canDrag = enabled && sourceOrder.length > 1;

  const orderKey = order.join(',');
  const prevRects = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>();
    for (const [id, element] of rowRefs.current) {
      const rect = element.getBoundingClientRect();
      const prev = prevRects.current.get(id);
      const deltaY = prev ? prev.top - rect.top : 0;
      if (deltaY) {
        element.style.transition = 'none';
        element.style.transform = `translateY(${deltaY}px)`;
        element.getBoundingClientRect(); // ép reflow để trình duyệt ghi nhận vị trí bắt đầu trước khi chuyển
        element.style.transition = 'transform 160ms ease-out';
        element.style.transform = '';
      }
      next.set(id, rect);
    }
    prevRects.current = next;
  }, [orderKey]);

  const reorderedBy = (clientY: number): string[] | null => {
    const id = draggingId.current;
    if (!id) return null;
    const rows = order.flatMap((itemId) => rowRefs.current.get(itemId) ?? []);
    let targetIndex = rows.length - 1;
    for (let index = 0; index < rows.length; index++) {
      const rect = rows[index]?.getBoundingClientRect();
      if (rect && clientY < rect.top + rect.height / 2) {
        targetIndex = index;
        break;
      }
    }
    const fromIndex = order.indexOf(id);
    if (fromIndex === -1 || fromIndex === targetIndex) return null;
    const next = order.slice();
    next.splice(fromIndex, 1);
    next.splice(targetIndex, 0, id);
    return next;
  };

  const dragHandleProps = (id: string): DragHandleProps => ({
    onPointerDown: (event) => {
      draggingId.current = id;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event) => {
      if (!draggingId.current) return;
      pendingClientY.current = event.clientY;
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        const clientY = pendingClientY.current;
        const next = clientY === null ? null : reorderedBy(clientY);
        if (next) setDragState({ key: sourceKey, order: next });
      });
    },
    onPointerUp: () => {
      if (!draggingId.current) return;
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      const clientY = pendingClientY.current;
      const finalOrder = (clientY === null ? null : reorderedBy(clientY)) ?? order;
      draggingId.current = null;
      pendingClientY.current = null;
      if (finalOrder.some((id, index) => id !== sourceOrder[index])) onReorder(finalOrder);
    },
  });

  const setRef = (id: string, element: HTMLLIElement | null) => {
    if (element) rowRefs.current.set(id, element);
    else rowRefs.current.delete(id);
  };

  return { order, canDrag, setRef, dragHandleProps };
};

/** Danh sách con kéo thả được để đổi Thứ tự con; số thứ tự tự đánh lại 1..N khi thả, gồm con của mọi vợ/chồng. */
const ReorderableChildren = ({
  treeId,
  items,
  canEdit,
}: {
  treeId: string;
  items: ChildRelative<Person>[];
  canEdit: boolean;
}) => {
  const reorder = useReorderChildren(treeId);
  const byId = new Map(items.map((child) => [child.person.id, child]));
  const sourceOrder = items.map((child) => child.person.id);
  const { order, canDrag, setRef, dragHandleProps } = useDragReorder(sourceOrder, canEdit, (next) => reorder.mutate(next));

  return (
    <>
      {order.flatMap((id, index) => {
        const child = byId.get(id);
        if (!child) return [];
        return (
          <li key={id} ref={(element) => setRef(id, element)} className="flex flex-wrap items-center gap-3 px-5 py-3">
            {canDrag && (
              <button
                type="button"
                aria-label="Kéo để đổi thứ tự con"
                className="cursor-grab touch-none select-none px-1 text-xl text-ink-muted active:cursor-grabbing"
                {...dragHandleProps(id)}
              >
                ⠿
              </button>
            )}
            <Link to={`/gia-pha/${treeId}/nguoi/${child.person.id}`} className="group min-w-0 flex-1">
              <span className="block text-sm text-ink-muted">
                {[birthOrderLabel(index + 1), child.kind === 'nuoi' ? 'Con nuôi' : ''].filter(Boolean).join(' · ')}
              </span>
              <span className="text-lg font-semibold group-hover:text-son group-hover:underline">{child.person.full_name}</span>
              <span className="ml-2 text-ink-muted">{lifespanText(child.person)}</span>
            </Link>
          </li>
        );
      })}
      {reorder.isError && <li className="px-5 py-3 text-sm text-danger">{reorder.error.message}</li>}
    </>
  );
};

/** Danh sách vợ/chồng kéo thả được để đổi Thứ tự hôn phối; "Vợ cả/Vợ hai…" tự đánh lại khi thả. */
const ReorderableSpouses = ({
  treeId,
  viewerId,
  items,
  canEdit,
}: {
  treeId: string;
  viewerId: string;
  items: SpouseRelative<Person>[];
  canEdit: boolean;
}) => {
  const reorder = useReorderUnions(treeId);
  const byId = new Map(items.map((spouse) => [spouse.unionId, spouse]));
  const sourceOrder = items.map((spouse) => spouse.unionId);
  const { order, canDrag, setRef, dragHandleProps } = useDragReorder(sourceOrder, canEdit, (next) =>
    reorder.mutate({ viewerId, orderedUnionIds: next }),
  );

  return (
    <>
      {order.flatMap((unionId, index) => {
        const spouse = byId.get(unionId);
        if (!spouse) return [];
        return (
          <li key={unionId} ref={(element) => setRef(unionId, element)} className="flex flex-wrap items-center gap-3 px-5 py-3">
            {canDrag && (
              <button
                type="button"
                aria-label="Kéo để đổi thứ tự vợ/chồng"
                className="cursor-grab touch-none select-none px-1 text-xl text-ink-muted active:cursor-grabbing"
                {...dragHandleProps(unionId)}
              >
                ⠿
              </button>
            )}
            <Link to={`/gia-pha/${treeId}/nguoi/${spouse.person.id}`} className="group min-w-0 flex-1">
              <span className="block text-sm text-ink-muted">{spouseLabel(spouse.person.gender, index + 1)}</span>
              <span className="text-lg font-semibold group-hover:text-son group-hover:underline">{spouse.person.full_name}</span>
              <span className="ml-2 text-ink-muted">{lifespanText(spouse.person)}</span>
            </Link>
            {canEdit ? (
              <UnionStatusSelect treeId={treeId} viewerId={viewerId} unionId={spouse.unionId} status={spouse.status} />
            ) : (
              spouse.status !== 'con' && <Tag>{UNION_STATUS_LABELS[spouse.status]}</Tag>
            )}
          </li>
        );
      })}
      {reorder.isError && <li className="px-5 py-3 text-sm text-danger">{reorder.error.message}</li>}
    </>
  );
};

/** "Đây là tôi" (liên kết tài khoản, mồi Danh sách nhắc giỗ) và bật/tắt nhắc giỗ của riêng Người này. */
const ReminderControls = ({ treeId, person, isMe }: { treeId: string; person: Person; isMe: boolean }) => {
  const link = useLinkAccountToPerson(treeId);
  const mutedList = useMutedGioPersons();
  const toggle = useToggleGioMute();
  const muted = mutedList.data?.some((row) => row.personId === person.id) ?? false;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
      {isMe ? (
        <Tag>Đây là bạn</Tag>
      ) : (
        <button
          type="button"
          className="font-semibold text-son hover:underline disabled:text-ink-muted"
          disabled={link.isPending}
          onClick={() => link.mutate(person.id)}
        >
          Đánh dấu đây là tôi
        </button>
      )}
      {mutedList.isSuccess && (
        <button
          type="button"
          className="font-semibold text-son hover:underline disabled:text-ink-muted"
          disabled={toggle.mute.isPending || toggle.unmute.isPending}
          onClick={() => (muted ? toggle.unmute.mutate(person.id) : toggle.mute.mutate(person.id))}
        >
          {muted ? 'Thêm lại vào Danh sách nhắc giỗ' : 'Bỏ khỏi Danh sách nhắc giỗ'}
        </button>
      )}
      {(link.isError || toggle.mute.isError || toggle.unmute.isError) && (
        <span className="text-danger">{link.error?.message ?? toggle.mute.error?.message ?? toggle.unmute.error?.message}</span>
      )}
    </div>
  );
};

/** Ảnh đại diện trong đầu trang: chỉ hiện, không sửa ở đây — sửa trong mục "Ảnh tư liệu". */
const PersonAvatar = ({ person }: { person: Person }) => {
  const avatar = useAvatarDataUrl(person.avatar_path);
  const initial = nameInitial(person.full_name);
  // Màu theo giới tính (như trên Cây) để nổi khỏi nền giấy, không chìm khi chưa có ảnh; đã mất thì viền xám.
  const genderColor = person.gender === 'nu' ? 'var(--color-son)' : person.gender === 'nam' ? 'var(--color-kim)' : 'var(--color-ink-muted)';
  const borderColor = person.is_deceased ? 'var(--color-ink-muted)' : genderColor;

  return (
    <div
      className="size-24 shrink-0 overflow-hidden rounded-full border-2"
      style={{ borderColor, backgroundColor: avatar.data ? undefined : genderColor }}
    >
      {avatar.data ? (
        <img src={avatar.data} alt="" className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center text-3xl font-bold text-white">{initial}</span>
      )}
    </div>
  );
};

/** Mục "Ảnh tư liệu": tối đa vài ảnh/người (giới hạn ở database), chú thích, chọn một ảnh làm đại diện. */
const PhotoGallery = ({ treeId, person, canEdit }: { treeId: string; person: Person; canEdit: boolean }) => {
  const photos = usePersonPhotos(person.id);
  const upload = useUploadPhoto(treeId, person.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPickError(null);
    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      setPickError('Chỉ nhận ảnh JPEG, PNG hoặc WEBP.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setPickError(`Ảnh tối đa ${Math.floor(MAX_AVATAR_BYTES / (1024 * 1024))}MB.`);
      return;
    }
    upload.mutate({ treeId, personId: person.id, file, caption: null, setAsAvatar: (photos.data?.length ?? 0) === 0 });
  };

  if (!canEdit && (photos.data?.length ?? 0) === 0) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-xl font-bold">Ảnh tư liệu</h2>
        {canEdit && (
          <Button variant="ghost" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
            {upload.isPending ? 'Đang tải lên…' : '+ Thêm ảnh'}
          </Button>
        )}
      </div>
      {canEdit && <input ref={inputRef} type="file" accept={AVATAR_MIME_TYPES.join(',')} className="hidden" onChange={pick} />}
      {(pickError || upload.isError) && <ErrorBanner>{pickError ?? upload.error?.message}</ErrorBanner>}
      {photos.isSuccess && photos.data.length === 0 && <p className="mt-2 text-ink-muted">Chưa có ảnh.</p>}
      {photos.isSuccess && photos.data.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {photos.data.map((photo) => (
            <PhotoCard key={photo.id} treeId={treeId} personId={person.id} photo={photo} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </section>
  );
};

const PhotoCard = ({
  treeId,
  personId,
  photo,
  canEdit,
}: {
  treeId: string;
  personId: string;
  photo: PersonPhoto;
  canEdit: boolean;
}) => {
  const image = useAvatarDataUrl(photo.storage_path);
  const setAvatar = useSetAvatarPhoto(treeId, personId);
  const updateCaption = useUpdatePhotoCaption(treeId, personId);
  const remove = useRemovePhoto(treeId, personId);
  const [caption, setCaption] = useState(photo.caption ?? '');

  return (
    <li className="space-y-1.5">
      <div className="aspect-square overflow-hidden rounded-xl border border-line bg-paper">
        {image.data && <img src={image.data} alt={photo.caption ?? ''} className="size-full object-cover" />}
      </div>
      {canEdit ? (
        <input
          aria-label="Chú thích ảnh"
          placeholder="Chú thích…"
          className="w-full rounded-lg border border-line bg-surface px-2 py-1 text-sm"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          onBlur={() => {
            if (caption !== (photo.caption ?? '')) updateCaption.mutate({ photoId: photo.id, caption: caption.trim() || null });
          }}
        />
      ) : (
        photo.caption && <p className="text-sm text-ink-muted">{photo.caption}</p>
      )}
      {canEdit && (
        <div className="flex items-center justify-between text-sm">
          {photo.is_avatar ? (
            <span className="font-semibold text-son">Ảnh đại diện</span>
          ) : (
            <button
              type="button"
              className="font-semibold text-son hover:underline disabled:text-ink-muted"
              disabled={setAvatar.isPending}
              onClick={() => setAvatar.mutate(photo.id)}
            >
              Đặt làm đại diện
            </button>
          )}
          <button
            type="button"
            className="text-danger hover:underline disabled:text-ink-muted"
            disabled={remove.isPending}
            onClick={() => remove.mutate({ photoId: photo.id, path: photo.storage_path })}
          >
            Xoá
          </button>
        </div>
      )}
      {(setAvatar.isError || updateCaption.isError || remove.isError) && (
        <p className="text-sm text-danger">{setAvatar.error?.message ?? updateCaption.error?.message ?? remove.error?.message}</p>
      )}
    </li>
  );
};

const Empty = ({ children }: { children: ReactNode }) => <li className="px-5 py-3 text-ink-muted">{children}</li>;

const Tag = ({ children }: { children: ReactNode }) => (
  <span className="rounded-full border border-line bg-surface px-3 py-1">{children}</span>
);
