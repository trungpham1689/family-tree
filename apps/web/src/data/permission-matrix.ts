/**
 * Bảng quyền duy nhất cho Người và Sự kiện — nguồn chung của hai bên đường nối TS/SQL:
 * `permissions.test.ts` kiểm tra các hàm quyền trên giao diện (`permissions.ts`) khớp từng dòng, còn `tests/db/permission-matrix.test.ts`
 * chạy đúng từng dòng đó với RLS/RPC thật trong database. Đổi luật quyền: sửa bảng này, cả hai bên đều phải theo.
 */

/** Vai trò của người thao tác; `none` là tài khoản không có vai trò nào trong gia phả. */
// Không import TreeRole từ trees.ts: tests/db dùng tệp này mà không kéo theo client Supabase của giao diện.
export type Actor = 'owner' | 'editor' | 'viewer' | 'none';
/** Ai tạo ra Người/Sự kiện: chính người thao tác hay một người khác. */
export type Creator = 'self' | 'other';

export type PersonCase = { actor: Actor; creator: Creator; edit: boolean; deleteNow: boolean; requestDelete: boolean };
export type EventCase = { actor: Actor; creator: Creator; edit: boolean };

const person = (actor: Actor, creator: Creator, edit: boolean, deleteNow: boolean, requestDelete: boolean): PersonCase => ({
  actor,
  creator,
  edit,
  deleteNow,
  requestDelete,
});

/** Người xem và người ngoài không tạo được gì nên chỉ có dòng `other`. */
export const PERSON_MATRIX: readonly PersonCase[] = [
  person('owner', 'self', true, true, false),
  person('owner', 'other', true, true, false),
  person('editor', 'self', true, false, true),
  person('editor', 'other', true, false, true),
  person('viewer', 'other', false, false, false),
  person('none', 'other', false, false, false),
];

export const EVENT_MATRIX: readonly EventCase[] = [
  { actor: 'owner', creator: 'self', edit: true },
  { actor: 'owner', creator: 'other', edit: true },
  { actor: 'editor', creator: 'self', edit: true },
  { actor: 'editor', creator: 'other', edit: false },
  { actor: 'viewer', creator: 'other', edit: false },
  { actor: 'none', creator: 'other', edit: false },
];
