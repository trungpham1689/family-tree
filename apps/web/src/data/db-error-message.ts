/**
 * Đổi lỗi từ database/PostgREST thành câu tiếng Việt cho người dùng.
 * Mã lỗi nghiệp vụ (ví dụ TREE_LIMIT_REACHED) do migration tự raise trong `message`.
 */
export type DbErrorLike = {
  code?: string | undefined;
  message?: string | undefined;
  details?: string | null | undefined;
};

const BUSINESS_MESSAGES: Record<string, (details?: string | null) => string> = {
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
  ACCOUNT_NOT_FOUND: () => 'Chưa có tài khoản dùng email này. Mời họ tạo tài khoản trước rồi mời lại.',
  ALREADY_OWNER: () => 'Người này đã là Chủ sở hữu của gia phả.',
  CANNOT_CHANGE_OWNER: () => 'Không thể đổi hay gỡ vai trò của Chủ sở hữu.',
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
