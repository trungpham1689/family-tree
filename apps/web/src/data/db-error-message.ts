/**
 * Đổi lỗi từ database/PostgREST thành câu tiếng Việt cho người dùng.
 * Mã lỗi nghiệp vụ (ví dụ TREE_LIMIT_REACHED) do migration tự raise trong `message`.
 */
export type DbErrorLike = {
  code?: string | undefined;
  message?: string | undefined;
  details?: string | null | undefined;
};

export const BUSINESS_MESSAGES: Record<string, (details?: string | null) => string> = {
  TREE_LIMIT_REACHED: (details) =>
    `Bạn đã tạo đủ số gia phả cho phép. ${details ?? ''}`.trim() +
    ' Hãy xoá bớt một gia phả cũ nếu muốn tạo mới.',
  PERSON_LIMIT_REACHED: (details) => `Gia phả đã đủ số Người cho phép. ${details ?? ''}`.trim(),
  PHOTO_LIMIT_REACHED: (details) => `${details ?? 'Đã đủ số ảnh cho phép.'} Hãy xoá một ảnh cũ nếu muốn thêm.`,
  ANCESTOR_CYCLE: () => 'Không thể nối như vậy: một người không thể là tổ tiên của chính mình.',
  TOO_MANY_PARENTS: () => 'Người này đã có đủ cha và mẹ ruột. Có thể ghi thêm cha/mẹ nuôi.',
  SAME_TREE_REQUIRED: () => 'Chỉ nối được với Người trong cùng gia phả.',
  TREE_NOT_EMPTY: () => 'Gia phả này đã có người. Chỉ nhập Excel vào gia phả mới hoặc gia phả chưa có ai.',
  NOT_TREE_OWNER: () => 'Chỉ Chủ sở hữu gia phả mới nhập được từ Excel.',
  STALE_VERSION: () => 'Đã có người sửa Người này trước bạn. Hãy xem bản mới nhất rồi lưu lại.',
  PERSON_NOT_FOUND: () => 'Không tìm thấy Người này. Có thể đã bị xoá; hãy tải lại trang.',
  ACCOUNT_NOT_FOUND: () => 'Không tìm thấy tài khoản này.',
  INVALID_EMAIL: () => 'Email không hợp lệ. Hãy kiểm tra lại.',
  TOO_MANY_INVITATIONS: () => 'Gia phả đang có quá nhiều lời mời chờ đăng ký (tối đa 50). Hãy huỷ bớt lời mời cũ.',
  ALREADY_OWNER: () => 'Người này đã là Chủ sở hữu của gia phả.',
  CANNOT_CHANGE_OWNER: () => 'Không thể đổi hay gỡ vai trò của Chủ sở hữu.',
  NEW_OWNER_NOT_EDITOR: () => 'Chỉ chuyển quyền Chủ sở hữu được cho một Biên tập viên của gia phả này.',
  NEW_OWNER_NOT_APPROVED: () => 'Tài khoản này đang chờ duyệt hoặc bị chặn nên chưa nhận quyền Chủ sở hữu được.',
  NEW_OWNER_TREE_LIMIT:(details) => `Người nhận đã sở hữu đủ số gia phả cho phép. ${details ?? ''}`.trim(),
  TOO_MANY_ATTEMPTS: () => 'Nhập sai mật khẩu quá nhiều lần. Hãy thử lại sau 10 phút.',
  NOT_ALLOWED: () => 'Bạn không có quyền làm việc này trong gia phả.',
  NOT_TREE_MEMBER: () => 'Bạn chưa có vai trò trong gia phả này.',
  INVALID_ROLE: () => 'Vai trò không hợp lệ. Chỉ mời được Biên tập viên hoặc Người xem.',
  LINK_NOT_ENABLED: () => 'Link chia sẻ công khai chưa được bật.',
  PASSWORD_TOO_SHORT: () => 'Mật khẩu quá ngắn. Hãy đặt ít nhất 4 ký tự.',
  SAME_PERSON: () => 'Hãy chọn hai người khác nhau.',
  UNION_NOT_FOUND: () => 'Không tìm thấy cuộc hôn phối này. Có thể đã bị xoá; hãy tải lại trang.',
  PHOTO_NOT_FOUND: () => 'Không tìm thấy ảnh này. Có thể đã bị xoá; hãy tải lại trang.',
  PHOTO_PATH_INVALID: () => 'Đường dẫn ảnh không thuộc gia phả này.',
  PHOTO_IMMUTABLE: () => 'Không thể chuyển ảnh sang Người hay gia phả khác.',
  ROOT_ONLY: () => 'Chỉ siêu quản trị gốc mới cấp hoặc gỡ quyền siêu quản trị.',
  SUPERADMIN_PROTECTED: () => 'Không thể thu hồi hay gỡ quyền của siêu quản trị gốc. Siêu quản trị khác phải được gỡ quyền trước khi thu hồi.',
  ACCOUNT_BANNED: () => 'Tài khoản đang bị chặn. Hãy bỏ chặn trước khi duyệt.',
  ACCOUNT_OWNS_TREES: () => 'Tài khoản này đang sở hữu gia phả nên không xoá được (xoá sẽ mất cả gia phả). Hãy chặn tài khoản thay vì xoá.',
  EVENT_HOST_INVALID: () => 'Người chủ trì phải thuộc cùng gia phả với sự kiện.',
  EVENT_NOT_FOUND: () => 'Không tìm thấy sự kiện này (có thể đã bị xoá).',
  EVENT_PHOTO_LIMIT_REACHED: () => 'Mỗi sự kiện tối đa 5 ảnh.',
  PROFILE_REQUIRED: () => 'Cần nhập họ và tên, ngày sinh và số điện thoại.',
  PROFILE_INVALID: () => 'Họ và tên, ngày sinh hoặc số điện thoại chưa hợp lệ.',
  TREE_IMMUTABLE: () => 'Không thể chuyển Người sang gia phả khác.',
};

const POSTGRES_MESSAGES: Record<string, string> = {
  '42501': 'Bạn không có quyền làm việc này trong gia phả.',
  '23514': 'Thông tin chưa hợp lệ. Hãy kiểm tra lại các ô đã nhập.',
  '23505': 'Thông tin này đã tồn tại.',
  '23503': 'Dữ liệu liên quan không còn tồn tại. Hãy tải lại trang.',
  PGRST116: 'Không tìm thấy dữ liệu. Có thể nó đã bị xoá hoặc bạn không có quyền xem.',
};

const FALLBACK = 'Có lỗi xảy ra. Hãy thử lại sau ít phút.';

export const dbErrorMessage = (error: DbErrorLike): string => {
  const message = error.message ?? '';
  const business = Object.keys(BUSINESS_MESSAGES).find((code) => message.includes(code));
  if (business) return BUSINESS_MESSAGES[business]!(error.details);

  if (/row-level security/i.test(message)) return POSTGRES_MESSAGES['42501']!;
  if (error.code && POSTGRES_MESSAGES[error.code]) return POSTGRES_MESSAGES[error.code]!;
  if (/failed to fetch|network/i.test(message)) return 'Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.';
  return FALLBACK;
};

/** Lỗi có mang mã nghiệp vụ này không (mã do migration raise trong `message`) — dùng thay cho so chuỗi rải rác. */
export const hasDbCode = (error: DbErrorLike | null | undefined, code: keyof typeof BUSINESS_MESSAGES): boolean =>
  Boolean(error?.message?.includes(code));
