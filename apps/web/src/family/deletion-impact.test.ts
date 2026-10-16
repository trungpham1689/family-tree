import { describe, expect, it } from 'vitest';
import { deletionImpact } from './deletion-impact';

// to ─ con (vợ: dau) ─ chau ;  to ─ con-2
const parentLinks = [
  { parent_id: 'to', child_id: 'con' },
  { parent_id: 'to', child_id: 'con-2' },
  { parent_id: 'con', child_id: 'chau' },
  { parent_id: 'dau', child_id: 'chau' },
];
const unions = [{ partner_a: 'con', partner_b: 'dau' }];

describe('deletionImpact', () => {
  it('người không có con: không cần gõ tên, không ai thành chưa nối ngoài vợ/chồng', () => {
    expect(deletionImpact({ personId: 'con-2', rootId: 'to', parentLinks, unions })).toEqual({
      links: 1,
      hasDescendants: false,
      orphaned: [],
    });
  });

  it('người có con cháu: phải gõ tên; con cháu và dâu thành chưa nối', () => {
    const impact = deletionImpact({ personId: 'con', rootId: 'to', parentLinks, unions });
    expect(impact.hasDescendants).toBe(true);
    expect(impact.links).toBe(3);
    expect(impact.orphaned.sort()).toEqual(['chau', 'dau']);
  });

  it('người chưa nối thì không làm ai rời cây', () => {
    expect(deletionImpact({ personId: 'lac', rootId: 'to', parentLinks, unions }).orphaned).toEqual([]);
  });
});
