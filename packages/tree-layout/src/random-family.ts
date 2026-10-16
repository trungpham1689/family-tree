import type { LayoutParentLink, LayoutPerson, LayoutUnion } from './layout.ts';

/** Bộ sinh số ngẫu nhiên có hạt giống (mulberry32), để test tái hiện được. */
const seeded = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type RandomFamily = {
  persons: LayoutPerson[];
  parentLinks: LayoutParentLink[];
  unions: LayoutUnion[];
  rootId: string;
};

/**
 * Sinh một gia phả ngẫu nhiên: mỗi người trong họ có 0–3 vợ/chồng và 0–5 con,
 * phần lớn con có cả cha lẫn mẹ, một ít chưa rõ cha/mẹ còn lại.
 * Chỉ dùng cho test và đo hiệu năng.
 */
export const randomFamily = (seed: number, targetSize: number, maxGenerations = 8): RandomFamily => {
  const random = seeded(seed);
  const pick = (max: number) => Math.floor(random() * (max + 1));
  const persons: LayoutPerson[] = [];
  const parentLinks: LayoutParentLink[] = [];
  const unions: LayoutUnion[] = [];

  const create = (gender: string, birthYear: number, birthOrder: number | null): LayoutPerson => {
    const person = { id: `n${persons.length}`, full_name: `Người ${persons.length}`, gender, birth_order: birthOrder, birth_year: birthYear };
    persons.push(person);
    return person;
  };

  const root = create('nam', 1800, null);
  let generation: LayoutPerson[] = [root];
  for (let level = 1; level < maxGenerations && persons.length < targetSize; level += 1) {
    const next: LayoutPerson[] = [];
    for (const parent of generation) {
      if (persons.length >= targetSize) break;
      const spouseCount = pick(10) < 2 ? 0 : pick(10) < 8 ? 1 : 1 + pick(2);
      const spouses: LayoutPerson[] = [];
      for (let order = 1; order <= spouseCount; order += 1) {
        const spouse = create(parent.gender === 'nam' ? 'nu' : 'nam', (parent.birth_year ?? 1800) + pick(6) - 3, null);
        unions.push({ partner_a: parent.id, partner_b: spouse.id, order_for_a: order, order_for_b: 1 });
        spouses.push(spouse);
      }
      const childCount = pick(5);
      for (let index = 0; index < childCount && persons.length < targetSize; index += 1) {
        const child = create(pick(1) ? 'nam' : 'nu', (parent.birth_year ?? 1800) + 22 + index * 2, index + 1);
        parentLinks.push({ child_id: child.id, parent_id: parent.id });
        const otherParent = spouses.length > 0 && pick(10) > 1 ? spouses[pick(spouses.length - 1)] : undefined;
        if (otherParent) parentLinks.push({ child_id: child.id, parent_id: otherParent.id });
        next.push(child);
      }
    }
    if (next.length === 0) break;
    generation = next;
  }
  return { persons, parentLinks, unions, rootId: root.id };
};
