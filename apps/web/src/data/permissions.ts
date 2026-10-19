import type { TreeRole } from './trees';

/** Quyền theo Vai trò, dùng để ẩn/hiện nút trên giao diện. Quyền thật do RLS trong database quyết định (ADR 0001). */
export const canEditTree = (role: TreeRole | undefined): boolean => role === 'owner' || role === 'editor';
export const isTreeOwner = (role: TreeRole | undefined): boolean => role === 'owner';

export type PersonRights = {
  /** Sửa hồ sơ, ảnh, cờ hiển thị của Người này (cùng luật với RLS bảng persons / person_photos). */
  edit: boolean;
  /** Xoá ngay: chỉ Chủ sở hữu. */
  deleteNow: boolean;
  /** Gửi yêu cầu xoá chờ duyệt: Biên tập viên đã tạo Người này, chưa có yêu cầu nào. */
  requestDelete: boolean;
  /** Duyệt hoặc từ chối yêu cầu xoá đang chờ: chỉ Chủ sở hữu. */
  reviewDeletion: boolean;
  /** Thấy câu "đang chờ Chủ sở hữu duyệt yêu cầu xoá" (người gửi yêu cầu hoặc Chủ sở hữu). */
  involvedInDeletion: boolean;
};

/**
 * Quyền trên một Người cụ thể: Chủ sở hữu mọi Người; Biên tập viên chỉ Người mình tạo; Người xem không gì cả.
 * Giao diện chỉ ẩn/hiện nút theo đây; RLS và các hàm quyền trong database mới là nơi quyết định thật (tests/db khớp với luật này).
 */
export const personPermissions = (
  role: TreeRole | undefined,
  accountId: string | null,
  person: { created_by: string | null; pending_delete_by: string | null },
): PersonRights => {
  const owner = isTreeOwner(role);
  const edit = owner || (canEditTree(role) && accountId !== null && person.created_by === accountId);
  return {
    edit,
    deleteNow: owner,
    requestDelete: !owner && edit && person.pending_delete_by === null,
    reviewDeletion: owner && person.pending_delete_by !== null,
    involvedInDeletion: person.pending_delete_by !== null && (owner || person.pending_delete_by === accountId),
  };
};
