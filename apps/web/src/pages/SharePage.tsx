import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth/auth-context';
import type { Invitation, Member } from '../data/members';
import { ROLE_LABELS } from '../data/role-labels';
import {
  useCancelInvitation,
  useFamily,
  useInvitations,
  useInviteMember,
  useMembers,
  useRemoveMember,
  useSetMemberPerson,
  useSetMemberRole,
  useTree,
} from '../data/tree-queries';
import type { Person, TreeWithRole } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { personLabel } from '../people/person-label';
import { PersonPicker } from '../people/PersonPicker';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ErrorBanner, TextField } from '../ui/fields';
import { FullPageMessage } from '../ui/FullPageMessage';

type InviteRole = 'editor' | 'viewer';

/** Màn "Chia sẻ": ai có vai trò gì, mời thêm, đổi/gỡ vai trò, liên kết tài khoản với Người. */
export const SharePage = () => {
  const { treeId = '' } = useParams();
  const { state } = useAuth();
  const email = state.status === 'signed-in' ? state.session.user.email : undefined;
  const tree = useTree(treeId);
  const family = useFamily(treeId);

  if (tree.isPending || family.isPending) return <FullPageMessage>Đang tải…</FullPageMessage>;
  const error = tree.error ?? family.error;

  return (
    <>
      <AppHeader email={email} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link to={`/gia-pha/${treeId}`} className="text-ink-muted hover:text-son">
          ← {tree.data?.name ?? 'Gia phả'}
        </Link>
        <h1 className="mt-3 font-serif text-3xl font-bold text-son">Chia sẻ</h1>
        {error && <ErrorBanner>{error.message}</ErrorBanner>}
        {tree.data && family.data && <ShareView tree={tree.data} graph={family.data} />}
      </main>
    </>
  );
};

const ShareView = ({ tree, graph }: { tree: TreeWithRole; graph: FamilyGraph<Person> }) => {
  const canEdit = tree.role === 'owner' || tree.role === 'editor';
  const members = useMembers(tree.id);
  const invitations = useInvitations(tree.id, canEdit);
  const [linking, setLinking] = useState<Member | null>(null);
  const linked = new Set((members.data ?? []).flatMap((member) => (member.personId ? [member.personId] : [])));

  return (
    <div className="mt-6 space-y-10">
      {canEdit && <InviteForm treeId={tree.id} />}

      <section aria-labelledby="thanh-vien">
        <h2 id="thanh-vien" className="font-serif text-2xl font-bold">
          Người có quyền
        </h2>
        {members.isPending && <p className="mt-2 text-ink-muted">Đang tải…</p>}
        {members.isError && <ErrorBanner>{members.error.message}</ErrorBanner>}
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
          {(members.data ?? []).map((member) => (
            <MemberRow
              key={member.accountId}
              tree={tree}
              graph={graph}
              member={member}
              canEdit={canEdit}
              onLink={() => setLinking(member)}
            />
          ))}
        </ul>
      </section>

      {canEdit && invitations.data && invitations.data.length > 0 && (
        <section aria-labelledby="loi-moi">
          <h2 id="loi-moi" className="font-serif text-2xl font-bold">
            Lời mời đang chờ
          </h2>
          <p className="mt-1 text-ink-muted">
            Những email này chưa có tài khoản. Khi họ đăng ký bằng đúng email đó, gia phả tự hiện trong “Gia phả của tôi”.
          </p>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
            {invitations.data.map((invitation) => (
              <InvitationRow key={invitation.id} invitation={invitation} />
            ))}
          </ul>
        </section>
      )}

      <Dialog
        open={linking !== null}
        title={linking?.isMe ? 'Tôi là ai trong gia phả?' : `Liên kết ${linking?.email ?? ''}`}
        onClose={() => setLinking(null)}
      >
        {linking && (
          <LinkPersonForm
            treeId={tree.id}
            graph={graph}
            member={linking}
            taken={linked}
            onDone={() => setLinking(null)}
          />
        )}
      </Dialog>
    </div>
  );
};

const InviteForm = ({ treeId }: { treeId: string }) => {
  const invite = useInviteMember();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('viewer');
  const [result, setResult] = useState<{ email: string; status: 'added' | 'invited' } | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const target = email.trim();
    invite.mutate(
      { treeId, email: target, role },
      {
        onSuccess: (status) => {
          setResult({ email: target, status });
          setEmail('');
        },
      },
    );
  };

  return (
    <section aria-labelledby="moi" className="rounded-2xl border border-line bg-surface p-5">
      <h2 id="moi" className="font-serif text-2xl font-bold">
        Mời người thân
      </h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <TextField
          label="Email đăng nhập của họ"
          type="email"
          required
          autoComplete="off"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setResult(null);
          }}
        />
        <fieldset>
          <legend className="mb-1 font-medium">Vai trò</legend>
          <div className="flex flex-wrap gap-2">
            {(['viewer', 'editor'] as const).map((value) => (
              <label
                key={value}
                className={`flex min-h-12 cursor-pointer flex-col justify-center rounded-xl border px-4 py-2 ${
                  role === value ? 'border-son bg-son/5 text-son' : 'border-line'
                }`}
              >
                <input type="radio" className="sr-only" checked={role === value} onChange={() => setRole(value)} />
                <span className="font-semibold">{ROLE_LABELS[value]}</span>
                <span className="text-sm text-ink-muted">
                  {value === 'viewer' ? 'Xem toàn bộ, không sửa được' : 'Thêm, sửa, xoá Người và quan hệ'}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {invite.isError && <ErrorBanner>{invite.error.message}</ErrorBanner>}
        {result && (
          <p role="status" className="rounded-xl bg-kim/10 px-4 py-3">
            {result.status === 'added'
              ? `${result.email} đã có tài khoản và đã được thêm vào gia phả.`
              : `${result.email} chưa có tài khoản. Hãy nhắn cho họ đường link của app và đăng ký bằng đúng email này — gia phả sẽ tự hiện ra.`}
          </p>
        )}
        <Button type="submit" disabled={invite.isPending || !email.trim()}>
          {invite.isPending ? 'Đang mời…' : 'Mời'}
        </Button>
      </form>
    </section>
  );
};

type MemberRowProps = {
  tree: TreeWithRole;
  graph: FamilyGraph<Person>;
  member: Member;
  canEdit: boolean;
  onLink: () => void;
};

const MemberRow = ({ tree, graph, member, canEdit, onLink }: MemberRowProps) => {
  const navigate = useNavigate();
  const setRole = useSetMemberRole();
  const remove = useRemoveMember();
  const unlink = useSetMemberPerson();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isOwner = member.role === 'owner';
  const canChange = canEdit && !isOwner;
  const canLink = canEdit || member.isMe;
  const error = setRole.error ?? remove.error ?? unlink.error;

  const doRemove = () =>
    remove.mutate(
      { treeId: tree.id, accountId: member.accountId },
      { onSuccess: () => (member.isMe ? navigate('/gia-pha', { replace: true }) : setConfirmRemove(false)) },
    );

  return (
    <li className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">
            {member.email}
            {member.isMe && <span className="ml-2 text-sm font-normal text-ink-muted">(bạn)</span>}
          </p>
          <p className="text-sm text-ink-muted">
            {member.personId ? `Là ${personLabel(graph, member.personId)}` : 'Chưa liên kết với Người nào'}
          </p>
        </div>
        {canChange ? (
          <select
            aria-label={`Vai trò của ${member.email}`}
            className="min-h-12 rounded-xl border border-line bg-surface px-3"
            value={member.role}
            disabled={setRole.isPending}
            onChange={(event) =>
              setRole.mutate({ treeId: tree.id, accountId: member.accountId, role: event.target.value as InviteRole })
            }
          >
            <option value="editor">{ROLE_LABELS.editor}</option>
            <option value="viewer">{ROLE_LABELS.viewer}</option>
          </select>
        ) : (
          <span className="rounded-full bg-paper px-3 py-1 text-sm">{ROLE_LABELS[member.role]}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {canLink && (
          <Button variant="ghost" onClick={onLink}>
            {member.personId ? 'Đổi Người liên kết' : member.isMe ? 'Tôi là ai trong gia phả?' : 'Liên kết với Người'}
          </Button>
        )}
        {canLink && member.personId && (
          <Button
            variant="ghost"
            disabled={unlink.isPending}
            onClick={() => unlink.mutate({ treeId: tree.id, accountId: member.accountId, personId: null })}
          >
            Huỷ liên kết
          </Button>
        )}
        {!isOwner && (canEdit || member.isMe) && !confirmRemove && (
          <Button variant="ghost" className="text-danger" onClick={() => setConfirmRemove(true)}>
            {member.isMe ? 'Rời gia phả' : 'Gỡ khỏi gia phả'}
          </Button>
        )}
      </div>

      {confirmRemove && (
        <div className="rounded-xl bg-danger-soft px-4 py-3">
          <p className="text-danger">
            {member.isMe
              ? 'Bạn sẽ không còn xem được gia phả này cho tới khi được mời lại.'
              : `${member.email} sẽ mất quyền xem gia phả ngay lập tức.`}
          </p>
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" onClick={() => setConfirmRemove(false)}>
              Huỷ
            </Button>
            <Button className="bg-danger hover:bg-danger" disabled={remove.isPending} onClick={doRemove}>
              {member.isMe ? 'Rời' : 'Gỡ'}
            </Button>
          </div>
        </div>
      )}
      {error && <ErrorBanner>{error.message}</ErrorBanner>}
    </li>
  );
};

const InvitationRow = ({ invitation }: { invitation: Invitation }) => {
  const cancel = useCancelInvitation();
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div>
        <p className="font-semibold">{invitation.email}</p>
        <p className="text-sm text-ink-muted">Mời làm {ROLE_LABELS[invitation.role]}</p>
      </div>
      <Button variant="ghost" className="text-danger" disabled={cancel.isPending} onClick={() => cancel.mutate(invitation.id)}>
        Huỷ lời mời
      </Button>
      {cancel.isError && <ErrorBanner>{cancel.error.message}</ErrorBanner>}
    </li>
  );
};

type LinkFormProps = {
  treeId: string;
  graph: FamilyGraph<Person>;
  member: Member;
  taken: ReadonlySet<string>;
  onDone: () => void;
};

const LinkPersonForm = ({ treeId, graph, member, taken, onDone }: LinkFormProps) => {
  const link = useSetMemberPerson();
  return (
    <div className="space-y-4">
      <p className="text-ink-muted">
        Chọn Người là chính {member.isMe ? 'bạn' : 'tài khoản này'} trong gia phả. Dùng để lập danh sách nhắc giỗ theo tổ tiên
        trực hệ.
      </p>
      <PersonPicker
        graph={graph}
        label="Tìm Người"
        exclude={taken}
        onPick={(personId) => link.mutate({ treeId, accountId: member.accountId, personId }, { onSuccess: onDone })}
      />
      {link.isError && <ErrorBanner>{link.error.message}</ErrorBanner>}
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onDone}>
          Đóng
        </Button>
      </div>
    </div>
  );
};
