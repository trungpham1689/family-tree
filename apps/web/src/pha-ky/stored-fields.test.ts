import { describe, expect, it } from 'vitest';
import { DEFAULT_NARRATIVE_FIELDS } from './narrative';
import { FIELDS_KEY, readStoredFields, writeStoredFields, type FieldStorage } from './stored-fields';

const memory = (initial: Record<string, string> = {}): FieldStorage & { data: Record<string, string> } => {
  const data = { ...initial };
  return { data, getItem: (key) => data[key] ?? null, setItem: (key, value) => void (data[key] = value) };
};

describe('lựa chọn nội dung Phả ký đã lưu', () => {
  it('chưa lưu thì dùng mặc định: Tên gọi khác, Cha mẹ, Chức vụ & vai vế (Thứ tự con không chọn sẵn)', () => {
    const fields = readStoredFields(memory());
    expect([...fields].sort()).toEqual([...DEFAULT_NARRATIVE_FIELDS].sort());
    expect(fields.has('order')).toBe(false);
  });

  it('ghi rồi đọc lại đúng; bỏ hết cũng nhớ (không quay về mặc định)', () => {
    const storage = memory();
    writeStoredFields(storage, new Set(['marriage', 'burial']));
    expect([...readStoredFields(storage)].sort()).toEqual(['burial', 'marriage']);
    writeStoredFields(storage, new Set());
    expect(readStoredFields(storage).size).toBe(0);
  });

  it('dữ liệu hỏng hoặc kiểu lạ: dùng mặc định; nhóm lạ bị bỏ', () => {
    expect(readStoredFields(memory({ [FIELDS_KEY]: '{không phải JSON' })).size).toBe(DEFAULT_NARRATIVE_FIELDS.length);
    expect(readStoredFields(memory({ [FIELDS_KEY]: '{"a":1}' })).size).toBe(DEFAULT_NARRATIVE_FIELDS.length);
    expect([...readStoredFields(memory({ [FIELDS_KEY]: '["names","khong-co","family"]' }))]).toEqual(['names']);
  });

  it('lưu trữ không dùng được (null hoặc ném lỗi): không hỏng trang', () => {
    expect(readStoredFields(null).size).toBe(DEFAULT_NARRATIVE_FIELDS.length);
    const broken: FieldStorage = {
      getItem: () => {
        throw new Error('bị chặn');
      },
      setItem: () => {
        throw new Error('đầy');
      },
    };
    expect(readStoredFields(broken).size).toBe(DEFAULT_NARRATIVE_FIELDS.length);
    expect(() => writeStoredFields(broken, new Set(['names']))).not.toThrow();
    expect(() => writeStoredFields(null, new Set(['names']))).not.toThrow();
  });
});
