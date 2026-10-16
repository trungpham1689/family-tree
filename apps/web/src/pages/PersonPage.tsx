import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth/auth-context';
import {
  useAddChild,
  useAddParent,
  useAddSpouse,
  useFamily,
  useSetHiddenFromPublic,
  useSetProgenitor,
  useTree,
  useUpdateParentLinkKind,
  useUpdateUnion,
} from '../data/tree-queries';
import type { Person } from '../data/trees';
import type { FamilyGraph, ParentLinkKind, UnionStatus } from '../family/family-graph';
import { birthOrderLabel, kindLabel, LINK_KIND_LABELS, spouseLabel, UNION_STATUS_LABELS } from '../family/labels';
import { lifespanText } from '../people/person-display';
import { DeletePerson } from '../people/DeletePerson';
import { EditPerson } from '../people/EditPerson';
import { EMPTY_PERSON_FORM } from '../people/person-form';
import { PersonForm } from '../people/PersonForm';
import { ProfileInfo } from '../people/ProfileInfo';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ErrorBanner } from '../ui/fields';
import { FullPageMessage } from '../ui/FullPageMessage';

type Action = 'none' | 'edit' | 'add-child' | 'add-parent' | 'add-spouse' | 'delete';

export const PersonPage = () => {
  const { treeId = '', personId = '' } = useParams();
  const { state } = useAuth();
  const email = state.status === 'signed-in' ? state.session.user.email : undefined;
  const tree = useTree(treeId);
  const family = useFamily(treeId);

  if (tree.isPending || family.isPending) return <FullPageMessage>Đang tải…</FullPageMessage>;
  const error = tree.error ?? family.error;
  const person = family.data?.person(personId);

  return (
    <>
      <AppHeader email={email} />
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
          />
        )}
      </main>
    </>
  );
};

type DetailProps = { treeId: string; graph: FamilyGraph<Person>; person: Person; canEdit: boolean };

const PersonDetail = ({ treeId, graph, person, canEdit }: DetailProps) => {
  const [action, setAction] = useState<Action>('none');
  const placement = graph.placement(person.id);
  const branchRoot = placement.branchId ? graph.person(placement.branchId) : undefined;
  const parents = graph.parentsOf(person.id);
  const spouses = graph.spousesOf(person.id);
  const children = graph.childrenOf(person.id);
  const setProgenitor = useSetProgenitor(treeId);
  const close = () => setAction('none');

  return (
    <article className="mt-3">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold">{person.full_name}</h1>
          <p className="mt-1 text-lg text-ink-muted">{lifespanText(person) || 'Chưa rõ năm sinh'}</p>
          <dl className="mt-3 flex flex-wrap gap-2 text-sm">
            <Tag>{kindLabel(placement.kind, person.gender)}</Tag>
            {placement.generation !== null && <Tag>Đời {placement.generation}</Tag>}
            {branchRoot && <Tag>Chi {branchRoot.full_name}</Tag>}
            {person.birth_order !== null && <Tag>{birthOrderLabel(person.birth_order)}</Tag>}
          </dl>
        </div>
        {canEdit && (
          <Button variant="secondary" onClick={() => setAction('edit')}>
            Sửa thông tin
          </Button>
        )}
      </header>

      <ProfileInfo person={person} />

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
          spouses.map((spouse) => (
            <RelativeRow
              key={spouse.unionId}
              treeId={treeId}
              relative={spouse.person}
              caption={spouseLabel(spouse.person.gender, spouse.order)}
            >
              {canEdit ? (
                <UnionControls treeId={treeId} viewerId={person.id} unionId={spouse.unionId} order={spouse.order} status={spouse.status} />
              ) : (
                spouse.status !== 'con' && <Tag>{UNION_STATUS_LABELS[spouse.status]}</Tag>
              )}
            </RelativeRow>
          ))
        )}
      </Section>

      <Section
        title="Con"
        action={canEdit && <Button variant="ghost" onClick={() => setAction('add-child')}>+ Thêm con</Button>}
      >
        {children.length === 0 ? (
          <Empty>Chưa ghi con.</Empty>
        ) : (
          children.map(({ person: child, kind }) => (
            <RelativeRow
              key={child.id}
              treeId={treeId}
              relative={child}
              caption={[birthOrderLabel(child.birth_order), kind === 'nuoi' ? 'Con nuôi' : ''].filter(Boolean).join(' · ')}
            />
          ))
        )}
      </Section>

      {canEdit && (
        <div className="mt-10 space-y-6 border-t border-line pt-6">
          {placement.kind !== 'thuy_to' && placement.kind !== 'dau_re' && (
            <div>
              <Button variant="ghost" disabled={setProgenitor.isPending} onClick={() => setProgenitor.mutate(person.id)}>
                Đặt người này làm Thuỷ tổ
              </Button>
              <p className="mt-1 text-sm text-ink-muted">Đời của mọi người sẽ được tính lại từ người này.</p>
              {setProgenitor.isError && <ErrorBanner>{setProgenitor.error.message}</ErrorBanner>}
            </div>
          )}
          <HiddenFromPublicToggle treeId={treeId} person={person} />
          <Button variant="ghost" className="text-danger" onClick={() => setAction('delete')}>
            Xoá người này
          </Button>
        </div>
      )}

      <ActionDialogs
        treeId={treeId}
        graph={graph}
        person={person}
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
  spouses,
  action,
  onClose,
}: {
  treeId: string;
  graph: FamilyGraph<Person>;
  person: Person;
  spouses: Person[];
  action: Action;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const addChild = useAddChild(treeId);
  const addParent = useAddParent(treeId);
  const addSpouse = useAddSpouse(treeId);
  const [otherParentId, setOtherParentId] = useState<string>(spouses[0]?.id ?? '');
  const [linkKind, setLinkKind] = useState<ParentLinkKind>('ruot');

  const finish = () => {
    for (const mutation of [addChild, addParent, addSpouse]) mutation.reset();
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
      <select
        className="min-h-12 w-full rounded-xl border border-line bg-surface px-4"
        value={otherParentId}
        onChange={(event) => setOtherParentId(event.target.value)}
      >
        {spouses.map((spouse) => (
          <option key={spouse.id} value={spouse.id}>
            {spouse.full_name}
          </option>
        ))}
        <option value="">Không rõ / không ghi</option>
      </select>
    </label>
  );

  return (
    <Dialog open={action !== 'none'} title={titles[action]} onClose={finish}>
      {action === 'edit' && <EditPerson treeId={treeId} person={person} onDone={finish} />}
      {action === 'delete' && (
        <DeletePerson
          treeId={treeId}
          graph={graph}
          person={person}
          onCancel={finish}
          onDeleted={() => navigate(`/gia-pha/${treeId}`, { replace: true })}
        />
      )}
      {action === 'add-child' && (
        <PersonForm
          initial={EMPTY_PERSON_FORM}
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
      <select
        aria-label="Loại quan hệ"
        className="min-h-11 rounded-xl border border-line bg-surface px-3"
        value={value}
        disabled={update.isPending}
        onChange={(event) => update.mutate({ childId, parentId, kind: event.target.value === 'nuoi' ? 'nuoi' : 'ruot' })}
      >
        <option value="ruot">Ruột</option>
        <option value="nuoi">Nuôi</option>
      </select>
      {update.isError && <p className="mt-1 text-sm text-danger">{update.error.message}</p>}
    </div>
  );
};

const STATUS_VALUES: UnionStatus[] = ['con', 'ly_hon', 'goa'];

const UnionControls = ({
  treeId,
  viewerId,
  unionId,
  order,
  status,
}: {
  treeId: string;
  viewerId: string;
  unionId: string;
  order: number;
  status: UnionStatus;
}) => {
  const update = useUpdateUnion(treeId);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1 text-sm">
        Thứ
        <select
          aria-label="Thứ tự hôn phối"
          className="min-h-11 rounded-xl border border-line bg-surface px-2"
          value={order}
          disabled={update.isPending}
          onChange={(event) => update.mutate({ unionId, viewerId, order: Number(event.target.value) })}
        >
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <select
        aria-label="Trạng thái hôn phối"
        className="min-h-11 rounded-xl border border-line bg-surface px-3"
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
      </select>
      {update.isError && <p className="w-full text-sm text-danger">{update.error.message}</p>}
    </div>
  );
};

/** Các thông tin hồ sơ đã ghi; dòng nào trống thì không hiện. */
const HiddenFromPublicToggle = ({ treeId, person }: { treeId: string; person: Person }) => {
  const setHidden = useSetHiddenFromPublic(treeId);
  return (
    <div>
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

const Section = ({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) => (
  <section className="mt-8">
    <div className="flex items-center justify-between gap-4">
      <h2 className="font-serif text-xl font-bold">{title}</h2>
      {action}
    </div>
    <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">{children}</ul>
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

const Empty = ({ children }: { children: ReactNode }) => <li className="px-5 py-3 text-ink-muted">{children}</li>;

const Tag = ({ children }: { children: ReactNode }) => (
  <span className="rounded-full border border-line bg-surface px-3 py-1">{children}</span>
);
