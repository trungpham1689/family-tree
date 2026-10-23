import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/auth-context';
import {
  ADMIN_PAGE_SIZE,
  useAdminAccounts,
  useAdminCounts,
  useAdminOwnedTrees,
  useAdminTransferTree,
  useAdminUpdateProfile,
  useDeleteAccount,
  useSendPasswordReset,
  useSetApproval,
  useSetBanned,
  useSetSuperadmin,
  type AdminAccount,
  type AdminStatusFilter,
} from '../data/admin';
import { ProfileForm } from '../profile/ProfileForm';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ErrorBanner, TextField } from '../ui/fields';
import { Footer } from '../ui/Footer';

type Filter = AdminStatusFilter;
type Confirm = { account: AdminAccount; action: 'revoke' | 'promote' | 'demote' | 'ban' | 'unban' | 'delete' };

const FILTER_LABELS: Record<Filter, string> = { all: 'Tất cả', pending: 'Chờ duyệt', approved: 'Đã duyệt' };
const SEARCH_DELAY_MS = 300;

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'chưa bao giờ';

/** "1985-03-20" → "20/03/1985" (cắt chuỗi, không qua Date để khỏi lệch múi giờ). */
const formatBirthDate = (value: string) => value.split('-').reverse().join('/');

const CONFIRM_TEXT: Record<Confirm['action'], { title: string; body: (email: string) => string; button: string }> = {
  revoke: {
    title: 'Thu hồi quyền sử dụng',
    body: (email) => `${email} sẽ mất quyền xem và sửa mọi gia phả ngay lập tức (kể cả gia phả đã được mời) và không nhận email nhắc nữa. Dữ liệu không bị xoá; duyệt lại là dùng được tiếp.`,
    button: 'Thu hồi',
  },
  promote: {
    title: 'Cấp quyền siêu quản trị',
    body: (email) => `${email} sẽ vào được trang quản trị này, duyệt và thu hồi mọi tài khoản thường. Chỉ cấp cho người thật sự tin cậy.`,
    button: 'Cấp quyền',
  },
  ban: {
    title: 'Chặn tài khoản',
    body: (email) => `${email} sẽ không đăng nhập được nữa và mất quyền xem, sửa mọi gia phả ngay lập tức. Dữ liệu không bị xoá; bỏ chặn rồi duyệt lại là dùng được tiếp.`,
    button: 'Chặn',
  },
  unban: {
    title: 'Bỏ chặn tài khoản',
    body: (email) => `${email} đăng nhập lại được nhưng trở về trạng thái chờ duyệt cho tới khi bạn duyệt.`,
    button: 'Bỏ chặn',
  },
  delete: {
    title: 'Xoá tài khoản',
    body: (email) => `${email} sẽ bị xoá hẳn: đăng nhập, vai trò trong các gia phả được mời, nhắc nhở. Không hoàn tác được. Người đó có thể đăng ký lại bằng email này và phải chờ duyệt như người mới.`,
    button: 'Xoá vĩnh viễn',
  },
  demote: {
    title: 'Gỡ quyền siêu quản trị',
    body: (email) => `${email} sẽ không còn vào được trang quản trị. Tài khoản vẫn được giữ nguyên trạng thái đã duyệt.`,
    button: 'Gỡ quyền',
  },
};

export const AdminPage = () => {
  const { state } = useAuth();
  const myId = state.status === 'signed-in' ? state.session.user.id : '';
  const setApproval = useSetApproval();
  const setSuperadmin = useSetSuperadmin();
  const setBanned = useSetBanned();
  const deleteAccount = useDeleteAccount();
  const sendReset = useSendPasswordReset();
  const updateProfile = useAdminUpdateProfile();
  const [editing, setEditing] = useState<AdminAccount | null>(null);
  const [treesOf, setTreesOf] = useState<AdminAccount | null>(null);
  const [typed, setTyped] = useState('');
  const [filter, setFilter] = useState<Filter | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const counts = useAdminCounts();
  const pendingCount = counts.data?.pending ?? 0;
  const iAmRoot = counts.data?.iAmRoot ?? false;
  // Mặc định mở tab "Chờ duyệt" nếu đang có người chờ, không thì xem tất cả.
  const activeFilter: Filter = filter ?? (pendingCount > 0 ? 'pending' : 'all');
  const accounts = useAdminAccounts({ status: activeFilter, search: debouncedSearch, page });
  const visible = accounts.data?.accounts ?? [];
  const total = accounts.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  // Trang cuối trống sau khi duyệt/xoá hết người ở đó: quay về trang đầu (cách React khuyến nghị thay cho setState trong effect).
  if (accounts.isSuccess && !accounts.isPlaceholderData && page > 0 && visible.length === 0) setPage(0);

  const error = setApproval.error ?? setSuperadmin.error ?? setBanned.error ?? deleteAccount.error ?? sendReset.error;
  const busyId = setApproval.isPending
    ? setApproval.variables?.accountId
    : setSuperadmin.isPending
      ? setSuperadmin.variables?.accountId
      : setBanned.isPending
        ? setBanned.variables?.accountId
        : deleteAccount.isPending
          ? deleteAccount.variables?.accountId
          : undefined;
  // Gửi email đặt lại mật khẩu nhận theo email; hàng đó cũng khoá nút trong lúc gửi.
  const resettingEmail = sendReset.isPending ? sendReset.variables?.email : undefined;
  const resetAll = () => {
    updateProfile.reset();
    setApproval.reset();
    setSuperadmin.reset();
    setBanned.reset();
    deleteAccount.reset();
    sendReset.reset();
  };
  const ask = (account: AdminAccount, action: Confirm['action']) => {
    resetAll();
    setTyped('');
    setConfirm({ account, action });
  };

  const runConfirmed = () => {
    if (!confirm) return;
    const { account, action } = confirm;
    const done = { onSuccess: () => setConfirm(null) };
    if (action === 'revoke') setApproval.mutate({ accountId: account.accountId, approved: false }, done);
    else if (action === 'ban' || action === 'unban') setBanned.mutate({ accountId: account.accountId, banned: action === 'ban' }, done);
    else if (action === 'delete') deleteAccount.mutate({ accountId: account.accountId }, done);
    else setSuperadmin.mutate({ accountId: account.accountId, superadmin: action === 'promote' }, done);
  };

  return (
    <>
      <AppHeader />
      <main id="main" tabIndex={-1} className="focus:outline-none mx-auto max-w-4xl px-4 py-8">
        <Link to="/gia-pha" className="inline-flex min-h-11 items-center text-ink-muted hover:text-son">
          ← Gia phả của tôi
        </Link>
        <h1 className="mt-3 font-serif text-3xl font-bold text-son">Quản lý tài khoản</h1>
        <p className="mt-1 text-ink-muted">
          Duyệt người mới đăng ký, thu hồi quyền sử dụng
          {iAmRoot ? ' và cấp quyền siêu quản trị' : ''}. Tài khoản chưa duyệt không xem hay sửa được gì.
        </p>

        <div role="tablist" aria-label="Lọc tài khoản" className="mt-6 flex flex-wrap gap-2">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={key === activeFilter}
              onClick={() => {
                setFilter(key);
                setPage(0);
              }}
              className={`min-h-11 rounded-full border px-4 font-semibold ${
                key === activeFilter ? 'border-son bg-son text-white' : 'border-line bg-surface text-ink hover:bg-paper'
              }`}
            >
              {FILTER_LABELS[key]}
              {key === 'pending' && pendingCount > 0 && <span className="ml-2 rounded-full bg-kim-soft px-2 text-sm text-ink">{pendingCount}</span>}
              {key === 'all' && counts.data && <span className="ml-2 text-sm opacity-80">{counts.data.total}</span>}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <TextField
            label="Tìm theo họ tên, email hoặc số điện thoại"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </div>

        {error && (
          <div className="mt-4">
            <ErrorBanner>{error.message}</ErrorBanner>
          </div>
        )}
        {sendReset.isSuccess && (
          <p role="status" className="mt-4 rounded-xl bg-la/10 px-4 py-3 text-la">
            Đã gửi email đặt lại mật khẩu tới {sendReset.variables.email}.
          </p>
        )}
        {accounts.isPending && <p className="mt-6 text-ink-muted">Đang tải…</p>}
        {accounts.isError && (
          <div className="mt-6">
            <ErrorBanner>{accounts.error.message}</ErrorBanner>
          </div>
        )}
        {accounts.isSuccess && visible.length === 0 && (
          <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center text-ink-muted">
            {debouncedSearch ? 'Không có tài khoản nào khớp.' : activeFilter === 'pending' ? 'Không có tài khoản nào đang chờ duyệt.' : 'Chưa có tài khoản nào.'}
          </p>
        )}

        <ul className="mt-4 space-y-3">
          {visible.map((account) => (
            <AccountRow
              key={account.accountId}
              account={account}
              isMe={account.accountId === myId}
              iAmRoot={iAmRoot}
              busy={busyId === account.accountId || (resettingEmail !== undefined && resettingEmail === account.email)}
              onApprove={() => {
                resetAll();
                setApproval.mutate({ accountId: account.accountId, approved: true });
              }}
              onSendReset={() => {
                resetAll();
                sendReset.mutate({ email: account.email });
              }}
              onAsk={(action) => ask(account, action)}
              onEdit={() => {
                resetAll();
                setEditing(account);
              }}
              onShowTrees={() => {
                resetAll();
                setTreesOf(account);
              }}
            />
          ))}
        </ul>

        {total > ADMIN_PAGE_SIZE && (
          <nav aria-label="Chia trang" className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
              ← Trước
            </Button>
            <p role="status" className="text-ink-muted">
              Trang {page + 1}/{pageCount} · {total} tài khoản
            </p>
            <Button variant="secondary" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>
              Sau →
            </Button>
          </nav>
        )}

        <Dialog open={editing !== null} title="Sửa hồ sơ" onClose={() => setEditing(null)}>
          {editing && (
            <div className="space-y-4">
              <p className="break-all text-ink-muted">{editing.email}</p>
              <ProfileForm
                initial={{ fullName: editing.fullName ?? '', birthDate: editing.birthDate ?? '', phone: editing.phone ?? '' }}
                pending={updateProfile.isPending}
                error={updateProfile.error?.message}
                onCancel={() => setEditing(null)}
                onSubmit={(values) => updateProfile.mutate({ accountId: editing.accountId, values }, { onSuccess: () => setEditing(null) })}
              />
            </div>
          )}
        </Dialog>

        <Dialog open={treesOf !== null} title="Gia phả đang sở hữu" onClose={() => setTreesOf(null)}>
          {treesOf && <OwnedTreesPanel account={treesOf} />}
        </Dialog>

        <Dialog
          open={confirm !== null}
          title={confirm ? CONFIRM_TEXT[confirm.action].title : ''}
          onClose={() => {
            setConfirm(null);
            resetAll();
          }}
        >
          {confirm && (
            <div className="space-y-4">
              <p>{CONFIRM_TEXT[confirm.action].body(confirm.account.email)}</p>
              {confirm.action === 'delete' && (
                <TextField label="Gõ lại email để xác nhận" value={typed} autoComplete="off" onChange={(event) => setTyped(event.target.value)} />
              )}
              {error && <ErrorBanner>{error.message}</ErrorBanner>}
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setConfirm(null)}>
                  Huỷ
                </Button>
                <Button
                  variant={confirm.action === 'promote' || confirm.action === 'unban' ? 'primary' : 'danger'}
                  disabled={busyId !== undefined || (confirm.action === 'delete' && typed.trim().toLowerCase() !== confirm.account.email.toLowerCase())}
                  onClick={runConfirmed}
                >
                  {CONFIRM_TEXT[confirm.action].button}
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </main>
      <Footer />
    </>
  );
};

const AccountRow = ({
  account,
  isMe,
  iAmRoot,
  busy,
  onApprove,
  onSendReset,
  onAsk,
  onEdit,
  onShowTrees,
}: {
  account: AdminAccount;
  isMe: boolean;
  iAmRoot: boolean;
  busy: boolean;
  onApprove: () => void;
  onSendReset: () => void;
  onAsk: (action: Confirm['action']) => void;
  onEdit: () => void;
  onShowTrees: () => void;
}) => (
  <li className="rounded-2xl border border-line bg-surface p-4">
    <p className="break-words text-lg font-semibold">
      {account.fullName ?? account.email}
      {isMe && <span className="ml-2 text-sm font-normal text-ink-muted">(bạn)</span>}
    </p>
    {account.fullName && <p className="break-all text-ink-muted">{account.email}</p>}
    <p className="mt-1 flex flex-wrap gap-2">
      {account.isBanned ? (
        <Badge tone="red">Bị chặn</Badge>
      ) : account.isSuperadmin ? (
        <Badge tone="gold">{account.isRoot ? 'Super Admin' : 'Siêu quản trị'}</Badge>
      ) : account.approved ? (
        <Badge tone="green">Đã duyệt</Badge>
      ) : (
        <Badge tone="red">Chờ duyệt</Badge>
      )}
    </p>
    <p className="mt-2 text-sm text-ink-muted">
      Ngày sinh {account.birthDate ? formatBirthDate(account.birthDate) : '—'} · Điện thoại {account.phone ?? '—'}
    </p>
    <p className="mt-1 text-sm text-ink-muted">
      Người mời:{' '}
      {account.invitedBy.length === 0
        ? 'không có (tự đăng ký)'
        : account.invitedBy.map((who) => (who.fullName ? `${who.fullName} (${who.email})` : who.email)).join(', ')}
    </p>
    <p className="mt-1 text-sm text-ink-muted">
      Đăng ký {formatDate(account.createdAt)} · Đăng nhập gần nhất {formatDate(account.lastSignInAt)} · {account.treeCount} gia phả
    </p>
    <div className="mt-3 flex flex-wrap gap-2">
      <Button variant="secondary" disabled={busy} onClick={onEdit}>
        Sửa hồ sơ
      </Button>
      {!account.approved && !account.isBanned && (
        <Button disabled={busy} onClick={onApprove}>
          Duyệt
        </Button>
      )}
      {account.approved && !account.isSuperadmin && (
        <Button variant="secondary" disabled={busy} onClick={() => onAsk('revoke')}>
          Thu hồi
        </Button>
      )}
      {!account.isBanned && (
        <Button variant="secondary" disabled={busy} onClick={onSendReset}>
          Gửi link đặt lại mật khẩu
        </Button>
      )}
      {iAmRoot && !account.isSuperadmin && (
        <Button variant="secondary" disabled={busy} onClick={() => onAsk('promote')}>
          Cấp siêu quản trị
        </Button>
      )}
      {iAmRoot && account.isSuperadmin && !account.isRoot && (
        <Button variant="secondary" disabled={busy} onClick={() => onAsk('demote')}>
          Gỡ siêu quản trị
        </Button>
      )}
      {!account.isSuperadmin &&
        (account.isBanned ? (
          <Button variant="secondary" disabled={busy} onClick={() => onAsk('unban')}>
            Bỏ chặn
          </Button>
        ) : (
          <Button variant="ghost" className="text-danger!" disabled={busy} onClick={() => onAsk('ban')}>
            Chặn
          </Button>
        ))}
      {account.treeCount > 0 && (
        <Button variant="secondary" disabled={busy} onClick={onShowTrees}>
          Gia phả ({account.treeCount})
        </Button>
      )}
      {!account.isSuperadmin && (
        <Button variant="ghost" className="text-danger!" disabled={busy || account.treeCount > 0} onClick={() => onAsk('delete')}>
          Xoá
        </Button>
      )}
    </div>
    {!account.isSuperadmin && account.treeCount > 0 && (
      <p className="mt-2 text-sm text-ink-muted">Đang sở hữu gia phả nên không xoá được: đổi Chủ sở hữu các gia phả trước, hoặc chỉ chặn.</p>
    )}
  </li>
);

/** Gia phả một tài khoản đang sở hữu; siêu quản trị trao từng gia phả cho tài khoản khác (ví dụ khi Chủ sở hữu đã mất hoặc mất tài khoản). */
const OwnedTreesPanel = ({ account }: { account: AdminAccount }) => {
  const trees = useAdminOwnedTrees(account.accountId);
  const transfer = useAdminTransferTree();
  const [movingId, setMovingId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const startMoving = (treeId: string) => {
    transfer.reset();
    setNotice(null);
    setEmail('');
    setMovingId(treeId);
  };

  const submit = (event: FormEvent, treeName: string) => {
    event.preventDefault();
    if (!movingId) return;
    const address = email.trim().toLowerCase();
    transfer.mutate(
      { treeId: movingId, email: address },
      {
        onSuccess: () => {
          setMovingId(null);
          setNotice(`Đã chuyển "${treeName}" cho ${address}. ${account.email} giờ là Biên tập viên của gia phả này.`);
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <p className="break-all text-ink-muted">{account.email}</p>
      {notice && (
        <p role="status" className="rounded-xl bg-la/10 px-4 py-3 text-la">
          {notice}
        </p>
      )}
      {trees.isPending && <p className="text-ink-muted">Đang tải…</p>}
      {trees.isError && <ErrorBanner>{trees.error.message}</ErrorBanner>}
      {trees.isSuccess && trees.data.length === 0 && <p className="text-ink-muted">Tài khoản này không còn sở hữu gia phả nào.</p>}
      {trees.isSuccess && trees.data.length > 0 && (
        <ul className="divide-y divide-line">
          {trees.data.map((tree) => (
            <li key={tree.treeId} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>
                  <span className="font-semibold">{tree.name}</span>
                  <span className="ml-2 text-sm text-ink-muted">{tree.personCount} người</span>
                </p>
                {movingId !== tree.treeId && (
                  <Button variant="secondary" disabled={transfer.isPending} onClick={() => startMoving(tree.treeId)}>
                    Đổi Chủ sở hữu
                  </Button>
                )}
              </div>
              {movingId === tree.treeId && (
                <form className="mt-3 space-y-3 rounded-xl border border-line bg-paper p-4" onSubmit={(event) => submit(event, tree.name)}>
                  <TextField
                    label="Email tài khoản nhận gia phả"
                    type="email"
                    required
                    autoFocus
                    autoComplete="off"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <p className="text-sm text-ink-muted">
                    Tài khoản đó phải đã được duyệt. Họ thành Chủ sở hữu (toàn quyền, kể cả xoá gia phả); {account.email} lùi về Biên tập viên.
                  </p>
                  {transfer.isError && <ErrorBanner>{transfer.error.message}</ErrorBanner>}
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="secondary" disabled={transfer.isPending} onClick={() => setMovingId(null)}>
                      Huỷ
                    </Button>
                    <Button type="submit" variant="danger" disabled={transfer.isPending || !email.trim()}>
                      {transfer.isPending ? 'Đang chuyển…' : 'Đổi Chủ sở hữu'}
                    </Button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const BADGE_TONES = {
  gold: 'bg-kim-soft text-ink',
  green: 'bg-la/10 text-la',
  red: 'bg-danger-soft text-danger',
} as const;

const Badge = ({ tone, children }: { tone: keyof typeof BADGE_TONES; children: string }) => (
  <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${BADGE_TONES[tone]}`}>{children}</span>
);
