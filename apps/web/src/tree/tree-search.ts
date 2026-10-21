import { outsideDepthOfChild } from '@gia-pha/tree-layout';

/** Bỏ dấu, đổi đ→d, chữ thường, gộp khoảng trắng: "Nguyễn  Văn Ân" → "nguyen van an". */
export const normalizeName = (value: string): string =>
  value
    .normalize('NFD')
    .replaceAll(/\p{Mn}/gu, '')
    .replaceAll(/[đĐ]/g, 'd')
    .toLowerCase()
    .replaceAll(/\s+/g, ' ')
    .trim();

type SearchablePerson = { id: string; full_name: string; common_name?: string | null };

/**
 * Tìm Người theo tên, có hoặc không dấu. Mọi từ gõ vào phải có mặt trong họ tên hoặc tên thường gọi.
 * Kết quả khớp từ đầu tên được xếp trước, rồi theo tên.
 */
export const searchPersons = <P extends SearchablePerson>(persons: readonly P[], query: string, limit = 12): P[] => {
  const words = normalizeName(query).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const phrase = words.join(' ');
  const collator = new Intl.Collator('vi');

  return persons
    .flatMap((person) => {
      const names = [person.full_name, person.common_name ?? ''].map(normalizeName);
      if (!names.some((name) => words.every((word) => name.includes(word)))) return [];
      const rank = names.some((name) => name === phrase) ? 0 : names.some((name) => name.startsWith(phrase)) ? 1 : 2;
      return [{ person, rank }];
    })
    .sort((a, b) => a.rank - b.rank || collator.compare(a.person.full_name, b.person.full_name))
    .slice(0, limit)
    .map(({ person }) => person);
};

type Link = { child_id: string; parent_id: string };
type Union = { partner_a: string; partner_b: string };

export type RevealPlan = {
  /** Tập thu gọn mới: mọi tổ tiên trên đường tới người cần tìm đều được mở. */
  collapsed: Set<string>;
  /** Số đời Cháu ngoại tối thiểu để người đó hiện trên Cây. */
  outsideGenerations: number;
};

/**
 * Tính cần mở nhánh nào (và cần hiện Cháu ngoại bao nhiêu đời) để một Người hiện lên Cây.
 * Người ngoài họ (vợ/chồng) hiện cạnh người phối ngẫu nên đi theo đường của người phối ngẫu.
 * Trả về null nếu Người không nối được vào cây từ gốc.
 */
export const planReveal = (input: {
  targetId: string;
  rootId: string;
  genderOf: (personId: string) => string | null;
  parentLinks: readonly Link[];
  unions: readonly Union[];
  collapsed: ReadonlySet<string>;
  outsideGenerations: number;
}): RevealPlan | null => {
  const children = new Map<string, string[]>();
  for (const link of input.parentLinks) {
    const list = children.get(link.parent_id);
    if (list) list.push(link.child_id);
    else children.set(link.parent_id, [link.child_id]);
  }

  // Đường máu mủ ít đời "ngoại" nhất. Mỗi bước tăng 0 hoặc 1 nên xử lý theo từng mức (ngăn xếp của mức hiện tại, hàng chờ của mức kế): không dịch mảng như deque.
  const outside = new Map<string, number>([[input.rootId, 0]]);
  const via = new Map<string, string>();
  const buckets: string[][] = [[input.rootId]];
  for (let level = 0; level < buckets.length; level += 1) {
    const bucket = buckets[level]!;
    while (bucket.length > 0) {
      const id = bucket.pop()!;
      if (outside.get(id) !== level) continue;
      for (const child of children.get(id) ?? []) {
        const childDepth = outsideDepthOfChild(level, { gender: input.genderOf(id) });
        const known = outside.get(child);
        if (known !== undefined && known <= childDepth) continue;
        outside.set(child, childDepth);
        via.set(child, id);
        (buckets[childDepth] ??= []).push(child);
      }
    }
  }

  const anchor = outside.has(input.targetId)
    ? input.targetId
    : input.unions
        .flatMap((union) =>
          union.partner_a === input.targetId ? [union.partner_b] : union.partner_b === input.targetId ? [union.partner_a] : [],
        )
        .filter((partner) => outside.has(partner))
        .sort((a, b) => outside.get(a)! - outside.get(b)!)[0];
  if (anchor === undefined) return null;

  const collapsed = new Set(input.collapsed);
  // Mở mọi cha/mẹ của người trên đường đi, không chỉ cha/mẹ của đường ngắn nhất: bố cục vẽ con dưới cha/mẹ nào gặp trước.
  const parents = new Map<string, string[]>();
  for (const link of input.parentLinks) {
    const list = parents.get(link.child_id);
    if (list) list.push(link.parent_id);
    else parents.set(link.child_id, [link.parent_id]);
  }
  for (let step: string | undefined = anchor; step !== undefined; step = via.get(step)) {
    for (const parent of parents.get(step) ?? []) if (outside.has(parent)) collapsed.delete(parent);
  }
  return { collapsed, outsideGenerations: Math.max(input.outsideGenerations, outside.get(anchor)!) };
};
