/**
 * Mọi "gốc" khoá truy vấn (phần tử đầu của queryKey) và việc truy vấn đó có được giữ lại để xem khi mất mạng hay không.
 * Khoá cụ thể và "thao tác nào làm đổi khoá nào" nằm ở query-keys.ts; file này không import gì để lib/offline-cache dùng được
 * mà không kéo theo React hay Supabase. Thêm gốc mới mà quên khai ở đây thì query-keys.test.ts báo.
 */
export const QUERY_ROOTS = {
  // Dữ liệu gia phả, lịch, nhắc nhở: giữ để xem khi mất mạng.
  trees: { persisted: true },
  'reminder-watch': { persisted: true },
  'reminder-prefs': { persisted: true },
  'notification-reads': { persisted: true },
  // Trạng thái duyệt: giữ để mở app khi mất mạng không kẹt ở "Đang tải" (quyền thật vẫn do database kiểm mỗi lần có mạng).
  approval: { persisted: true },
  // Không giữ: link lịch (bí mật), ảnh (data URL nặng), trang công khai (kèm mật khẩu), danh sách ảnh.
  photos: { persisted: false },
  avatar: { persisted: false },
  avatars: { persisted: false },
  'calendar-feed': { persisted: false },
  // Không giữ: quyền siêu quản trị và danh sách tài khoản (email người khác) không nên nằm lại trên máy; quyền thật do database kiểm.
  superadmin: { persisted: false },
  // Không giữ: họ tên, ngày sinh, số điện thoại là thông tin riêng.
  profile: { persisted: false },
  admin: { persisted: false },
  'public-card': { persisted: false },
  public: { persisted: false },
} as const;

export type QueryRoot = keyof typeof QUERY_ROOTS;

export const isPersistedRoot = (root: unknown): boolean =>
  typeof root === 'string' && root in QUERY_ROOTS && QUERY_ROOTS[root as QueryRoot].persisted;
