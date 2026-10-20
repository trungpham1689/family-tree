import {
  useApproveDeletePerson,
  useAvatarDataUrl,
  useLinkAccountToPerson,
  useRejectDeletePerson,
  useMutedGioPersons,
  useSetHiddenFromPublic,
  useToggleGioMute,
} from '../../data/tree-queries';
import type { PersonRights } from '../../data/permissions';
import type { Person } from '../../data/trees';
import { nameInitial } from '../person-display';
import { Button } from '../../ui/Button';
import { ErrorBanner } from '../../ui/fields';
import { Tag } from './detail-bits';

/** Các thông tin hồ sơ đã ghi; dòng nào trống thì không hiện. */
export const HiddenFromPublicToggle = ({ treeId, person }: { treeId: string; person: Person }) => {
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
export const PendingDeleteBanner = ({
  treeId,
  person,
  rights,
}: {
  treeId: string;
  person: Person;
  rights: PersonRights;
}) => {
  const approve = useApproveDeletePerson(treeId);
  const reject = useRejectDeletePerson(treeId);
  // Đồng ý và từ chối là hai thao tác trái nhau trên cùng yêu cầu: đang gọi cái nào thì khoá cả hai.
  const busy = approve.isPending || reject.isPending;

  return (
    <div className="mt-6 rounded-xl bg-kim-soft px-4 py-3">
      <p className="font-medium">
        {rights.involvedInDeletion
          ? 'Đang chờ Chủ sở hữu duyệt yêu cầu xoá người này.'
          : 'Người này đang chờ duyệt xoá.'}
      </p>
      {rights.reviewDeletion && (
        <div className="mt-2 flex gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => reject.mutate(person.id)}>
            Từ chối
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => approve.mutate(person.id)}>
            Đồng ý xoá
          </Button>
        </div>
      )}
      {(approve.isError || reject.isError) && <ErrorBanner>{(approve.error ?? reject.error)?.message}</ErrorBanner>}
    </div>
  );
};

/**
 * "Đây là tôi" (liên kết tài khoản với Người) và bật/tắt nhắc giỗ của riêng Người này. Mỗi tài khoản chỉ đánh dấu được một Người:
 * đã đánh dấu thì nút ở những Người khác ẩn đi, đến khi bỏ đánh dấu. Nhắc giỗ chỉ có ở Người đã mất.
 */
export const ReminderControls = ({ treeId, person, linkedPersonId }: { treeId: string; person: Person; linkedPersonId: string | null }) => {
  const link = useLinkAccountToPerson(treeId);
  const mutedList = useMutedGioPersons();
  const toggle = useToggleGioMute();
  const muted = mutedList.data?.some((row) => row.personId === person.id) ?? false;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
      {linkedPersonId === person.id ? (
        <>
          <Tag>Đây là bạn</Tag>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-3 font-semibold text-son hover:bg-paper disabled:text-ink-muted"
            disabled={link.isPending}
            onClick={() => link.mutate(null)}
          >
            Bỏ đánh dấu đây là tôi
          </button>
        </>
      ) : (
        linkedPersonId === null && (
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-3 font-semibold text-son hover:bg-paper disabled:text-ink-muted"
            disabled={link.isPending}
            onClick={() => link.mutate(person.id)}
          >
            Đánh dấu đây là tôi
          </button>
        )
      )}
      {person.is_deceased && mutedList.isSuccess && (
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-3 font-semibold text-son hover:bg-paper disabled:text-ink-muted"
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

/** Ảnh đại diện trong đầu trang: chỉ hiện, không sửa ở đây — đổi ảnh trong "Sửa thông tin". */
export const PersonAvatar = ({ person }: { person: Person }) => {
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
