import { isTreeOwner } from '../data/permissions';
import { useState, type FormEvent } from 'react';
import { ROLE_LABELS } from '../data/role-labels';
import type { InvitableRole } from '../data/roles';
import {
  useApproveDeletePerson,
  useInviteToTree,
  usePendingDeletions,
  useRejectDeletePerson,
  useRemoveTreeRole,
  useTreeMembers,
  useUpdateTreeRole,
} from '../data/tree-queries';
import type { TreeWithRole } from '../data/trees';
import { Button } from '../ui/Button';
import { ErrorBanner, Select, TextField } from '../ui/fields';

/** Chỉ Chủ sở hữu mời người và đổi/gỡ vai trò. */
export const MembersPanel = ({ tree }: { tree: TreeWithRole }) => {
  const members = useTreeMembers(tree.id);
  const isOwner = isTreeOwner(tree.role);
  const canInvite = isOwner;
  const [inviting, setInviting] = useState(false);

  return (
    <section aria-labelledby="tai-khoan-co-quyen" className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="tai-khoan-co-quyen" className="font-serif text-2xl font-bold">
          Quản trị viên
        </h2>
        {canInvite && !inviting && <Button onClick={() => setInviting(true)}>+ Thêm quản trị</Button>}
      </div>

      {inviting && <InviteForm treeId={tree.id} onDone={() => setInviting(false)} />}

      {members.isPending && <p className="mt-3 text-ink-muted">Đang tải…</p>}
      {members.isError && (
        <div className="mt-3">
          <ErrorBanner>{members.error.message}</ErrorBanner>
        </div>
      )}
      {members.isSuccess && (
        <ul className="mt-4 divide-y divide-line">
          {members.data.map((member) => (
            <MemberRow key={member.account_id} treeId={tree.id} member={member} canManage={isOwner && member.role !== 'owner'} />
          ))}
        </ul>
      )}

      {isOwner && <PendingDeletions treeId={tree.id} />}
    </section>
  );
};

/** Yêu cầu xoá Người của Biên tập viên, đang chờ Chủ sở hữu duyệt. */
const PendingDeletions = ({ treeId }: { treeId: string }) => {
  const pending = usePendingDeletions(treeId, true);
  const approve = useApproveDeletePerson(treeId);
  const reject = useRejectDeletePerson(treeId);

  if (!pending.isSuccess || pending.data.length === 0) return null;

  return (
    <div className="mt-6 border-t border-line pt-4">
      <h3 className="font-serif text-lg font-bold">Yêu cầu xoá đang chờ duyệt</h3>
      <ul className="mt-3 divide-y divide-line">
        {pending.data.map((request) => (
          <li key={request.person_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="font-medium">{request.full_name}</p>
              <p className="text-sm text-ink-muted">Yêu cầu bởi {request.requested_by_email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" disabled={reject.isPending} onClick={() => reject.mutate(request.person_id)}>
                Từ chối
              </Button>
              <Button variant="danger" disabled={approve.isPending} onClick={() => approve.mutate(request.person_id)}>
                Đồng ý xoá
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {(approve.isError || reject.isError) && <ErrorBanner>{(approve.error ?? reject.error)?.message}</ErrorBanner>}
    </div>
  );
};

const InviteForm = ({ treeId, onDone }: { treeId: string; onDone: () => void }) => {
  const invite = useInviteToTree(treeId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>('editor');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    invite.mutate(
      { email: email.trim(), role },
      {
        onSuccess: () => {
          setEmail('');
          onDone();
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-line bg-paper p-4">
      <TextField
        label="Email tài khoản"
        type="email"
        required
        autoFocus
        placeholder="ten@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <label className="block">
        <span className="mb-1 block font-medium">Vai trò</span>
        <Select className="w-full" value={role} onChange={(event) => setRole(event.target.value as InvitableRole)}>
          <option value="editor">{ROLE_LABELS.editor} — thêm/sửa/xoá Người do mình tạo</option>
          <option value="viewer">{ROLE_LABELS.viewer} — chỉ xem bản đầy đủ</option>
        </Select>
      </label>
      {invite.isError && <ErrorBanner>{invite.error.message}</ErrorBanner>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" disabled={invite.isPending || !email.trim()}>
          {invite.isPending ? 'Đang mời…' : 'Mời'}
        </Button>
      </div>
    </form>
  );
};

type MemberRowProps = {
  treeId: string;
  member: { account_id: string; role: 'owner' | InvitableRole; email: string };
  canManage: boolean;
};

const MemberRow = ({ treeId, member, canManage }: MemberRowProps) => {
  const updateRole = useUpdateTreeRole(treeId);
  const remove = useRemoveTreeRole(treeId);
  const [removing, setRemoving] = useState(false);
  const error = updateRole.error ?? remove.error;

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div>
        <p className="font-medium">{member.email}</p>
        {error && (
          <div className="mt-1">
            <ErrorBanner>{error.message}</ErrorBanner>
          </div>
        )}
      </div>
      {canManage ? (
        removing ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-danger">Gỡ quyền của {member.email}?</span>
            <Button variant="secondary" onClick={() => setRemoving(false)}>
              Huỷ
            </Button>
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() => remove.mutate(member.account_id, { onSuccess: () => setRemoving(false) })}
            >
              Gỡ
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Select
              value={member.role}
              disabled={updateRole.isPending}
              onChange={(event) =>
                updateRole.mutate({ accountId: member.account_id, role: event.target.value as InvitableRole })
              }
            >
              <option value="editor">{ROLE_LABELS.editor}</option>
              <option value="viewer">{ROLE_LABELS.viewer}</option>
            </Select>
            <Button variant="ghost" className="text-danger!" onClick={() => setRemoving(true)}>
              Gỡ
            </Button>
          </div>
        )
      ) : (
        <span className="rounded-full bg-paper px-3 py-1 text-sm text-ink-muted">{ROLE_LABELS[member.role]}</span>
      )}
    </li>
  );
};
