import { describe, expect, it } from 'vitest';
import { blankPerson } from '../test-support/person';
import { buildFamilyGraph } from './family-graph';
import { babyGeneration, checkBabyName, givenNameOf, resolveBabyParents, splitBabyName, suggestOtherParent } from './name-check';

/**
 * Đời 1: Phạm Văn Tổ ─ vợ Nguyễn Thị Hoa
 * Đời 2: Phạm Đức Cả (mất), Phạm Văn Trung
 * Đời 3: Phạm Quốc Trung (mất), Phạm Quốc Bảo (còn), Phạm Minh Đức (mất), Lê Thị Mai (dâu)
 * Chưa nối: Phạm Lạc Trung
 */
const sample = () =>
  buildFamilyGraph({
    persons: [
      blankPerson({ id: 'to', full_name: 'Phạm Văn Tổ', gender: 'nam', is_progenitor: true, is_deceased: true, birth_year: 1850, death_year: 1920 }),
      blankPerson({ id: 'vo', full_name: 'Nguyễn Thị Hoa', gender: 'nu', is_deceased: true }),
      blankPerson({ id: 'ca', full_name: 'Phạm Đức Cả', gender: 'nam', is_deceased: true }),
      blankPerson({ id: 'tr2', full_name: 'Phạm Văn Trung', gender: 'nam' }),
      blankPerson({ id: 'trung', full_name: 'Phạm Quốc Trung', gender: 'nam', is_deceased: true }),
      blankPerson({ id: 'bao', full_name: 'Phạm Quốc Bảo', gender: 'nam' }),
      blankPerson({ id: 'duc', full_name: 'Phạm Minh Đức', gender: 'nam', is_deceased: true }),
      blankPerson({ id: 'mai', full_name: 'Lê Thị Mai', gender: 'nu' }),
      blankPerson({ id: 'lac', full_name: 'Phạm Lạc Trung', gender: 'nam' }),
    ],
    parentLinks: [],
    unions: [],
    positions: [
      { person_id: 'to', generation: 1, branch_id: null, kind: 'thuy_to' },
      { person_id: 'vo', generation: 1, branch_id: null, kind: 'dau_re' },
      { person_id: 'ca', generation: 2, branch_id: 'ca', kind: 'dinh' },
      { person_id: 'tr2', generation: 2, branch_id: 'tr2', kind: 'dinh' },
      { person_id: 'trung', generation: 3, branch_id: 'ca', kind: 'dinh' },
      { person_id: 'bao', generation: 3, branch_id: 'ca', kind: 'dinh' },
      { person_id: 'duc', generation: 3, branch_id: 'tr2', kind: 'dinh' },
      { person_id: 'mai', generation: 3, branch_id: 'tr2', kind: 'dau_re' },
    ],
  });

const conflictsOf = (name: string, generation: number, options?: { includeSpouses?: boolean }) => {
  const result = checkBabyName(sample(), name, generation, options);
  if (!result.ok) throw new Error(result.error);
  return result.conflicts;
};

describe('splitBabyName', () => {
  it('tên là chữ cuối, tên lót là chữ kế tên', () => {
    expect(splitBabyName('Phạm Đức Trung')).toEqual({ family: 'Phạm', middle: 'Đức', given: 'Trung' });
    expect(splitBabyName('  Phạm   Thị  Ngọc   Anh ')).toEqual({ family: 'Phạm', middle: 'Ngọc', given: 'Anh' });
  });

  it('hai chữ: có tên, không có tên lót; một chữ: không hợp lệ', () => {
    expect(splitBabyName('Phạm Trung')).toEqual({ family: 'Phạm', middle: null, given: 'Trung' });
    expect(splitBabyName('Trung')).toBeNull();
    expect(splitBabyName('   ')).toBeNull();
    expect(givenNameOf('Phạm Văn Tổ')).toBe('Tổ');
  });
});

describe('checkBabyName', () => {
  it('cùng Đời đã mất trùng tên: có; cùng Đời còn sống trùng tên: không', () => {
    const trung = conflictsOf('Phạm Hữu Trung', 3);
    // Phạm Quốc Trung (cùng Đời 3, đã mất) và Phạm Văn Trung (Đời 2, đời trên).
    expect(trung.map((c) => c.personId)).toEqual(['trung', 'tr2']);
    expect(trung[0]!.reasons.map((r) => r.kind)).toEqual(['same-generation-deceased']);
    expect(trung[0]!.reasons[0]!.text).toContain('Cùng Đời 3');
    // Bảo còn sống, cùng đời: không vi phạm.
    expect(conflictsOf('Phạm Hữu Bảo', 3)).toEqual([]);
  });

  it('tên của bé trùng tên của người đời trên (còn sống hay đã mất đều tính)', () => {
    const sameGeneration = conflictsOf('Phạm Hữu Trung', 3).find((c) => c.personId === 'tr2')!;
    expect(sameGeneration.reasons).toEqual([expect.objectContaining({ kind: 'ancestor-given' })]);
    expect(sameGeneration.deceased).toBe(false); // còn sống nhưng ở đời trên vẫn bị tính
    const fromDeeper = conflictsOf('Phạm Hữu Trung', 4);
    // Đời 4: Trung (Đời 2, còn sống) và Trung (Đời 3, đã mất) đều là đời trên.
    expect(fromDeeper.map((c) => c.personId).sort()).toEqual(['tr2', 'trung']);
    expect(fromDeeper.every((c) => c.reasons.some((r) => r.kind === 'ancestor-given'))).toBe(true);
  });

  it('tên lót của bé trùng tên của người đời trên', () => {
    const conflicts = conflictsOf('Phạm Đức Anh', 3);
    // Cả (Đời 2) tên "Cả" không trùng; Đức (Đời 3, cùng đời) không tính là đời trên và là tên lót, không phải tên.
    expect(conflicts).toEqual([]);
    const deeper = conflictsOf('Phạm Đức Anh', 4);
    expect(deeper.map((c) => c.personId)).toEqual(['duc']);
    expect(deeper[0]!.reasons[0]).toMatchObject({ kind: 'ancestor-middle' });
    expect(deeper[0]!.reasons[0]!.text).toContain('tên lót "Đức"');
  });

  it('một người có thể vi phạm cả hai điều kiện: tên lót trùng tên và tên trùng tên', () => {
    const conflicts = conflictsOf('Phạm Trung Trung', 4);
    const trung = conflicts.find((c) => c.personId === 'trung')!;
    expect(trung.reasons.map((r) => r.kind)).toEqual(['ancestor-given', 'ancestor-middle']);
  });

  it('chỉ xét từ Đời 1 tới Đời của bé: người đời dưới và người chưa nối bị bỏ qua', () => {
    // Bé Đời 2: Trung đời 3 (đã mất) và Lạc Trung (chưa nối) không tính; Văn Trung đời 2 còn sống cũng không.
    expect(conflictsOf('Phạm Hữu Trung', 2)).toEqual([]);
    expect(conflictsOf('Phạm Hữu Cả', 2).map((c) => c.personId)).toEqual(['ca']);
  });

  it('so khớp không phân biệt hoa thường nhưng giữ dấu', () => {
    expect(conflictsOf('phạm hữu TRUNG', 4).map((c) => c.personId).sort()).toEqual(['tr2', 'trung']);
    expect(conflictsOf('Phạm Hữu Trúng', 4)).toEqual([]);
  });

  it('Dâu/Rể: mặc định có tính, tắt thì bỏ qua', () => {
    expect(conflictsOf('Phạm Hữu Mai', 3).map((c) => c.personId)).toEqual([]); // Mai còn sống, cùng đời
    expect(conflictsOf('Phạm Hữu Mai', 4).map((c) => c.personId)).toEqual(['mai']);
    expect(conflictsOf('Phạm Hữu Mai', 4, { includeSpouses: false })).toEqual([]);
    expect(conflictsOf('Phạm Hữu Hoa', 2).map((c) => c.personId)).toEqual(['vo']);
  });

  it('sắp xếp: đời gần bé trước; kèm năm sinh – mất', () => {
    const conflicts = conflictsOf('Phạm Hữu Trung', 4);
    expect(conflicts.map((c) => c.generation)).toEqual([3, 2]);
    const to = conflictsOf('Phạm Hữu Tổ', 4)[0]!;
    expect(to.lifespan).toBe('1850 – 1920');
    expect(to.deceased).toBe(true);
  });

  it('tên huý của người đời trên cũng phải kiêng; trùng tên trong họ tên thì không báo hai lần', () => {
    const graph = buildFamilyGraph({
      persons: [
        blankPerson({ id: 'to', full_name: 'Phạm Văn Tổ', taboo_name: 'Phạm Công Lượng', gender: 'nam', is_progenitor: true, is_deceased: true }),
        blankPerson({ id: 'con', full_name: 'Phạm Văn Cả', taboo_name: 'Cả', gender: 'nam' }),
      ],
      parentLinks: [],
      unions: [],
      positions: [
        { person_id: 'to', generation: 1, branch_id: null, kind: 'thuy_to' },
        { person_id: 'con', generation: 2, branch_id: null, kind: 'dinh' },
      ],
    });
    const check = (name: string) => {
      const result = checkBabyName(graph, name, 3);
      if (!result.ok) throw new Error(result.error);
      return result.conflicts;
    };
    const luong = check('Phạm Hữu Lượng');
    expect(luong.map((c) => c.personId)).toEqual(['to']);
    expect(luong[0]!.reasons[0]!.text).toContain('tên huý "Lượng"');
    expect(check('Phạm Lượng Anh')[0]!.reasons[0]).toMatchObject({ kind: 'ancestor-middle' });
    expect(check('Phạm Hữu Cả')[0]!.reasons).toHaveLength(1);
  });

  it('đầu vào sai: báo lỗi thay vì trả kết quả', () => {
    expect(checkBabyName(sample(), 'Trung', 3)).toMatchObject({ ok: false });
    expect(checkBabyName(sample(), 'Phạm Đức Trung', 0)).toMatchObject({ ok: false });
    expect(checkBabyName(sample(), 'Phạm Đức Trung', 2.5)).toMatchObject({ ok: false });
  });
});

describe('babyGeneration', () => {
  it('Đời của cha/mẹ cộng một; bỏ qua người chưa có Đời; không ai có Đời thì null', () => {
    const graph = sample();
    expect(babyGeneration(graph, ['ca', null])).toBe(3);
    expect(babyGeneration(graph, [null, 'ca'])).toBe(3);
    expect(babyGeneration(graph, ['trung', 'mai'])).toBe(4);
    expect(babyGeneration(graph, ['lac'])).toBeNull(); // chưa nối vào cây
    expect(babyGeneration(graph, [null, null])).toBeNull();
    expect(babyGeneration(graph, ['khong-co'])).toBeNull();
  });
});

describe('gợi ý Ba/Mẹ còn lại', () => {
  const person = (id: string, gender: 'nam' | 'nu') => blankPerson({ id, full_name: id, gender });
  const marriage = (id: string, a: string, b: string, status: string) => ({ id, partner_a: a, partner_b: b, order_for_a: 1, order_for_b: 1, status });
  const graphWith = (unions: ReturnType<typeof marriage>[]) =>
    buildFamilyGraph({
      persons: [person('ba', 'nam'), person('me1', 'nu'), person('me2', 'nu'), person('me3', 'nu')],
      parentLinks: [],
      unions,
      positions: [],
    });

  it('đúng một vợ/chồng còn hôn phối thì gợi ý; không có thì không', () => {
    expect(suggestOtherParent(graphWith([marriage('u1', 'ba', 'me1', 'con')]), 'ba')).toBe('me1');
    expect(suggestOtherParent(graphWith([]), 'ba')).toBeNull();
  });

  it('ly hôn, goá không được gợi ý; còn đúng một người còn hôn phối trong nhiều người thì chọn người đó', () => {
    expect(suggestOtherParent(graphWith([marriage('u1', 'ba', 'me1', 'ly_hon')]), 'ba')).toBeNull();
    expect(suggestOtherParent(graphWith([marriage('u1', 'ba', 'me1', 'goa')]), 'ba')).toBeNull();
    expect(suggestOtherParent(graphWith([marriage('u1', 'ba', 'me1', 'ly_hon'), marriage('u2', 'ba', 'me2', 'con')]), 'ba')).toBe('me2');
  });

  it('nhiều người còn hôn phối thì không đoán', () => {
    expect(suggestOtherParent(graphWith([marriage('u1', 'ba', 'me1', 'con'), marriage('u2', 'ba', 'me2', 'con')]), 'ba')).toBeNull();
  });

  it('nhập Ba: Mẹ là vợ; nhập Mẹ: Ba là chồng; người dùng bỏ chọn thì để trống', () => {
    const graph = graphWith([marriage('u1', 'ba', 'me1', 'con')]);
    expect(resolveBabyParents(graph, 'ba', undefined)).toEqual({ chosenIsMother: false, fatherId: 'ba', motherId: 'me1' });
    expect(resolveBabyParents(graph, 'me1', undefined)).toEqual({ chosenIsMother: true, fatherId: 'ba', motherId: 'me1' });
    expect(resolveBabyParents(graph, 'ba', null)).toEqual({ chosenIsMother: false, fatherId: 'ba', motherId: null });
    expect(resolveBabyParents(graph, 'me1', 'ba')).toEqual({ chosenIsMother: true, fatherId: 'ba', motherId: 'me1' });
  });
});
