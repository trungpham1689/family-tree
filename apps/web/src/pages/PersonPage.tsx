import { canEditTree, isTreeOwner, personPermissions } from '../data/permissions';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { useFamily, useSetFoundsBranch, useSetProgenitor, useTree } from '../data/tree-queries';
import type { Person, TreeRole } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { birthOrderLabel, kindLabel } from '../family/labels';
import { lifespanText } from '../people/person-display';
import { PhotoGallery } from '../people/PersonPhotos';
import { ProfileInfo } from '../people/ProfileInfo';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/fields';
import { Footer } from '../ui/Footer';
import { FullPageMessage } from '../ui/FullPageMessage';
import { Section, RelativeRow, Empty, Tag } from '../people/detail/detail-bits';
import { ReorderableChildren } from '../people/detail/ChildList';
import { ReorderableSpouses } from '../people/detail/SpouseList';
import {
  HiddenFromPublicToggle,
  PendingDeleteBanner,
  ReminderControls,
  PersonAvatar,
} from '../people/detail/PersonControls';
import { ActionDialogs, LinkKindSelect, type Action } from '../people/detail/ActionDialogs';

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
            viewer={{
              canEdit: canEditTree(tree.data.role),
              isOwner: isTreeOwner(tree.data.role),
              role: tree.data.role,
              accountId,
              linkedPersonId: tree.data.linkedPersonId,
            }}
          />
        )}
      </main>
      <Footer />
    </>
  );
};

/** Người đang xem trang này: quyền theo Vai trò và danh tính, đi cùng nhau xuống các khối con. */
type Viewer = {
  canEdit: boolean;
  isOwner: boolean;
  role: TreeRole;
  accountId: string | null;
  linkedPersonId: string | null;
};

type DetailProps = {
  treeId: string;
  graph: FamilyGraph<Person>;
  person: Person;
  viewer: Viewer;
};

const PersonDetail = ({ treeId, graph, person, viewer }: DetailProps) => {
  const { canEdit, isOwner, accountId, linkedPersonId } = viewer;
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
  const rights = personPermissions(viewer.role, accountId, person);
  const canEditThisPerson = rights.edit;

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
        <PendingDeleteBanner treeId={treeId} person={person} rights={rights} />
      )}

      <ProfileInfo person={person} graph={graph} />

      <PhotoGallery treeId={treeId} personId={person.id} canEdit={false} />

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
            {rights.deleteNow ? 'Xoá người này' : 'Gửi yêu cầu xoá'}
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
