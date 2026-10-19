import { describe, expect, it } from 'vitest';
import { effects, queryKeys } from './query-keys';

const isPrefix = (prefix: readonly unknown[], key: readonly unknown[]) => prefix.every((part, index) => key[index] === part);
const touches = (effect: readonly (readonly unknown[])[], key: readonly unknown[]) => effect.some((prefix) => isPrefix(prefix, key));

describe('effects', () => {
  it('sửa hồ sơ / quan hệ / xoá / gộp đều làm mới lịch (ngày sinh, giỗ, cưới nằm trong lịch)', () => {
    for (const effect of [effects.family('t1'), effects.deletion('t1'), effects.merge('t1')]) {
      expect(touches(effect, queryKeys.calendar('acc-1'))).toBe(true);
      expect(touches(effect, queryKeys.family('t1'))).toBe(true);
    }
  });

  it('gộp người làm mới ảnh của mọi Người; đổi ảnh làm mới cả danh sách ảnh và gia phả', () => {
    expect(touches(effects.merge('t1'), queryKeys.photos('keep-id'))).toBe(true);
    expect(touches(effects.photos('t1', 'p1'), queryKeys.photos('p1'))).toBe(true);
    expect(touches(effects.photos('t1', 'p1'), queryKeys.photos('p2'))).toBe(false);
    expect(touches(effects.photos('t1', 'p1'), queryKeys.family('t1'))).toBe(true);
  });

  it('sự kiện làm mới lịch; xoá làm mới hàng chờ duyệt; gia phả khác không bị đụng', () => {
    expect(touches(effects.events('t1'), queryKeys.calendar('acc-1'))).toBe(true);
    expect(touches(effects.deletion('t1'), queryKeys.pendingDeletions('t1'))).toBe(true);
    expect(touches(effects.family('t1'), queryKeys.family('t2'))).toBe(false);
  });
});
