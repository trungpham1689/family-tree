import { ALL_NARRATIVE_FIELDS, DEFAULT_NARRATIVE_FIELDS, type NarrativeField } from './narrative';

/** Nơi nhớ lựa chọn: tối thiểu những gì `localStorage` có, để kiểm thử không cần trình duyệt. */
export type FieldStorage = Pick<Storage, 'getItem' | 'setItem'>;

// v3: mặc định đổi (bỏ Thứ tự con); lựa chọn lưu theo bản cũ không còn dùng.
export const FIELDS_KEY = 'gia-pha:pha-ky-fields-v3';

/** Nhóm nội dung đã chọn lần trước (nhớ theo trình duyệt); chưa có, hỏng hoặc không đọc được thì dùng mặc định. Bỏ qua nhóm lạ. */
export const readStoredFields = (storage: FieldStorage | null): Set<NarrativeField> => {
  try {
    const stored: unknown = JSON.parse(storage?.getItem(FIELDS_KEY) ?? 'null');
    if (Array.isArray(stored)) return new Set(ALL_NARRATIVE_FIELDS.filter((field) => stored.includes(field)));
  } catch {
    // dùng mặc định
  }
  return new Set(DEFAULT_NARRATIVE_FIELDS);
};

/** Nhớ lựa chọn; không lưu được (chế độ riêng tư, hết dung lượng…) thì bỏ qua, vẫn dùng bình thường trong phiên này. */
export const writeStoredFields = (storage: FieldStorage | null, fields: ReadonlySet<NarrativeField>): void => {
  try {
    storage?.setItem(FIELDS_KEY, JSON.stringify([...fields]));
  } catch {
    // bỏ qua
  }
};

/** `localStorage` của trình duyệt, hoặc null khi bị chặn (truy cập đã có thể ném lỗi). */
export const browserStorage = (): FieldStorage | null => {
  try {
    return localStorage;
  } catch {
    return null;
  }
};
