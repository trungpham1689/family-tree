import { describe, expect, it } from 'vitest';
import { buildFamilyGraph, childOrderPlan, compareBirthDate, orderWithNewChild, type GraphPerson } from './family-graph';

const person = (id: string, extra: Partial<GraphPerson> = {}): GraphPerson => ({
  id,
  full_name: id,
  gender: 'nam',
  birth_year: null,
  birth_order: null,
  ...extra,
});

const sample = () =>
  buildFamilyGraph({
    persons: [
      person('to'),
      person('vo-ca', { gender: 'nu' }),
      person('vo-hai', { gender: 'nu' }),
      person('con-thu', { birth_order: 2 }),
      person('con-truong', { birth_order: 1 }),
      person('con-ut', { gender: 'nu', birth_year: 1950 }),
      person('con-nuoi', { birth_year: 1940 }),
      person('lac', { gender: 'nu' }),
    ],
    parentLinks: [
      { child_id: 'con-thu', parent_id: 'to', kind: 'ruot' },
      { child_id: 'con-thu', parent_id: 'vo-ca', kind: 'ruot' },
      { child_id: 'con-truong', parent_id: 'to', kind: 'ruot' },
      { child_id: 'con-ut', parent_id: 'to', kind: 'ruot' },
      { child_id: 'con-nuoi', parent_id: 'to', kind: 'nuoi' },
    ],
    unions: [
      { id: 'u2', partner_a: 'to', partner_b: 'vo-hai', order_for_a: 2, order_for_b: 1, status: 'goa' },
      { id: 'u1', partner_a: 'vo-ca', partner_b: 'to', order_for_a: 1, order_for_b: 1, status: 'con' },
    ],
    positions: [
      { person_id: 'to', generation: 1, branch_id: null, kind: 'thuy_to' },
      { person_id: 'vo-ca', generation: 1, branch_id: null, kind: 'dau_re' },
      { person_id: 'vo-hai', generation: 1, branch_id: null, kind: 'dau_re' },
      { person_id: 'con-thu', generation: 2, branch_id: 'con-thu', kind: 'dinh' },
      { person_id: 'con-truong', generation: 2, branch_id: 'con-truong', kind: 'dinh' },
      { person_id: 'con-ut', generation: 2, branch_id: 'con-ut', kind: 'dinh' },
      { person_id: 'con-nuoi', generation: 2, branch_id: 'con-nuoi', kind: 'dinh' },
      { person_id: 'lac', generation: null, branch_id: null, kind: 'chua_noi' },
    ],
  });

describe('buildFamilyGraph', () => {
  it('xếp con theo Thứ tự con, rồi năm sinh', () => {
    const children = sample().childrenOf('to').map((child) => child.person.id);
    expect(children).toEqual(['con-truong', 'con-thu', 'con-nuoi', 'con-ut']);
  });

  it('ghi rõ con nuôi', () => {
    const adopted = sample()
      .childrenOf('to')
      .find((child) => child.person.id === 'con-nuoi');
    expect(adopted?.kind).toBe('nuoi');
  });

  it('xếp vợ/chồng theo Thứ tự hôn phối, nhìn từ phía người đang xem', () => {
    const spouses = sample().spousesOf('to');
    expect(spouses.map(({ person: spouse, order, status }) => [spouse.id, order, status])).toEqual([
      ['vo-ca', 1, 'con'],
      ['vo-hai', 2, 'goa'],
    ]);
    expect(sample().spousesOf('vo-ca').map((spouse) => spouse.person.id)).toEqual(['to']);
  });

  it('liệt kê cha trước mẹ', () => {
    expect(
      sample()
        .parentsOf('con-thu')
        .map((parent) => parent.person.id),
    ).toEqual(['to', 'vo-ca']);
  });

  it('thống kê nam, nữ, tổng theo Đời và bỏ qua Người chưa nối', () => {
    const generations = sample()
      .generations()
      .map(({ generation, male, female, total }) => ({ generation, male, female, total }));
    expect(generations).toEqual([
      { generation: 1, male: 1, female: 2, total: 3 },
      { generation: 2, male: 3, female: 1, total: 4 },
    ]);
  });

  it('trong mỗi Đời xếp theo gia đình: Thuỷ tổ, rồi các vợ theo thứ tự; con của vợ cả trước, con chỉ ghi cha sau, rồi theo Thứ tự con', () => {
    const [first, second] = sample().generations();
    expect(first!.persons.map((p) => p.id)).toEqual(['to', 'vo-ca', 'vo-hai']);
    expect(second!.persons.map((p) => p.id)).toEqual(['con-thu', 'con-truong', 'con-nuoi', 'con-ut']);
  });

  describe('thứ tự các Đời theo thứ tự của Đời trước', () => {
    // Đời 1: tổ + 1 vợ. Đời 2: A (có 2 vợ: Va1, Va2), B (có vợ Vb). Đời 3: con của A+Va2, A+Va1 (đặt tên cố ý ngược thứ tự), con của B+Vb, con chỉ ghi A.
    const graph = () =>
      buildFamilyGraph({
        persons: [
          person('to'), person('vt', { gender: 'nu' }),
          person('B', { birth_order: 2 }), person('A', { birth_order: 1 }),
          person('Va2', { gender: 'nu' }), person('Va1', { gender: 'nu' }), person('Vb', { gender: 'nu' }),
          person('z-con-A-Va1'), person('a-con-A-Va2'), person('m-con-B'), person('k-con-A-ma-chua-ro'),
        ],
        parentLinks: [
          ...['A', 'B'].flatMap((child) => [{ child_id: child, parent_id: 'to', kind: 'ruot' }, { child_id: child, parent_id: 'vt', kind: 'ruot' }]),
          { child_id: 'z-con-A-Va1', parent_id: 'A', kind: 'ruot' }, { child_id: 'z-con-A-Va1', parent_id: 'Va1', kind: 'ruot' },
          { child_id: 'a-con-A-Va2', parent_id: 'A', kind: 'ruot' }, { child_id: 'a-con-A-Va2', parent_id: 'Va2', kind: 'ruot' },
          { child_id: 'm-con-B', parent_id: 'B', kind: 'ruot' }, { child_id: 'm-con-B', parent_id: 'Vb', kind: 'ruot' },
          { child_id: 'k-con-A-ma-chua-ro', parent_id: 'A', kind: 'ruot' },
        ],
        unions: [
          { id: 'u0', partner_a: 'to', partner_b: 'vt', order_for_a: 1, order_for_b: 1, status: 'con' },
          { id: 'u1', partner_a: 'A', partner_b: 'Va1', order_for_a: 1, order_for_b: 1, status: 'con' },
          { id: 'u2', partner_a: 'A', partner_b: 'Va2', order_for_a: 2, order_for_b: 1, status: 'con' },
          { id: 'u3', partner_a: 'B', partner_b: 'Vb', order_for_a: 1, order_for_b: 1, status: 'con' },
        ],
        positions: [
          { person_id: 'to', generation: 1, branch_id: null, kind: 'thuy_to' }, { person_id: 'vt', generation: 1, branch_id: null, kind: 'dau_re' },
          ...['A', 'B'].map((id) => ({ person_id: id, generation: 2, branch_id: id, kind: 'dinh' })),
          ...['Va1', 'Va2', 'Vb'].map((id) => ({ person_id: id, generation: 2, branch_id: null, kind: 'dau_re' })),
          ...['z-con-A-Va1', 'a-con-A-Va2', 'm-con-B', 'k-con-A-ma-chua-ro'].map((id) => ({ person_id: id, generation: 3, branch_id: 'x', kind: 'dinh' })),
        ],
      });

    it('Đời 2: người trong họ theo Thứ tự con, mỗi người liền sau là các vợ theo thứ tự hôn phối', () => {
      expect(graph().generations()[1]!.persons.map((p) => p.id)).toEqual(['A', 'Va1', 'Va2', 'B', 'Vb']);
    });

    it('Đời 3 theo thứ tự Đời 2: con của A+vợ cả, con của A+vợ hai, con chỉ ghi A, rồi con của B (không theo tên)', () => {
      expect(graph().generations()[2]!.persons.map((p) => p.id)).toEqual(['z-con-A-Va1', 'a-con-A-Va2', 'k-con-A-ma-chua-ro', 'm-con-B']);
    });

    it('mọi Đời: vị trí cha mẹ trong Đời trước không giảm dần theo danh sách của Đời sau', () => {
      const generations = graph().generations();
      for (let index = 1; index < generations.length; index += 1) {
        const before = new Map(generations[index - 1]!.persons.map((p, position) => [p.id, position]));
        const parents = generations[index]!.persons.flatMap((p) => {
          const positions = graph().parentsOf(p.id).flatMap((parent) => before.get(parent.person.id) ?? []);
          return positions.length > 0 ? [Math.min(...positions)] : [];
        });
        expect(parents).toEqual([...parents].sort((a, b) => a - b));
      }
    });
  });

  it('liệt kê Người chưa nối', () => {
    expect(sample().unconnected().map((p) => p.id)).toEqual(['lac']);
    expect(sample().placement('lac')).toEqual({ generation: null, branchId: null, kind: 'chua_noi' });
  });

  it('Người không có trong kết quả vị trí coi như chưa nối', () => {
    const graph = buildFamilyGraph({ persons: [person('x')], parentLinks: [], unions: [], positions: [] });
    expect(graph.placement('x').kind).toBe('chua_noi');
  });
});

describe('compareBirthDate', () => {
  const born = (year: number | null, month: number | null = null, day: number | null = null) =>
    person('x', { birth_year: year, birth_month: month, birth_day: day });

  it('xếp theo năm, rồi tháng, rồi ngày', () => {
    const list = [born(1990, 5, 2), born(1989, 12, 31), born(1990, 5, 1), born(1990, 1, 20)];
    const sorted = [...list].sort(compareBirthDate).map((p) => [p.birth_year, p.birth_month, p.birth_day]);
    expect(sorted).toEqual([[1989, 12, 31], [1990, 1, 20], [1990, 5, 1], [1990, 5, 2]]);
  });

  it('thiếu tháng/ngày xếp sau người có đủ trong cùng kỳ; thiếu năm xếp cuối; bằng nhau trả 0', () => {
    expect(compareBirthDate(born(1990, 3), born(1990))).toBeLessThan(0);
    expect(compareBirthDate(born(1990, 3, 4), born(1990, 3))).toBeLessThan(0);
    expect(compareBirthDate(born(2000), born(null))).toBeLessThan(0);
    expect(compareBirthDate(born(null), born(null))).toBe(0);
  });

  it('con không có Thứ tự con tự xếp theo ngày sinh đầy đủ, trước khi so tên', () => {
    const graph = buildFamilyGraph({
      persons: [
        person('cha'),
        person('b', { birth_year: 1990, birth_month: 6, birth_day: 1 }),
        person('a', { birth_year: 1990, birth_month: 2, birth_day: 9 }),
        person('c', { birth_year: 1991 }),
      ],
      parentLinks: ['b', 'a', 'c'].map((child_id) => ({ child_id, parent_id: 'cha', kind: 'ruot' })),
      unions: [],
      positions: [],
    });
    expect(graph.childrenOf('cha').map((child) => child.person.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('orderWithNewChild', () => {
  const kid = (id: string, year: number | null, month: number | null = null, day: number | null = null) =>
    person(id, { birth_year: year, birth_month: month, birth_day: day });
  const siblings = [kid('a', 1990), kid('b', 1995, 3, 1), kid('c', 2000)];

  it('chèn vào đúng chỗ theo ngày sinh, giữ thứ tự những người đã có', () => {
    expect(orderWithNewChild(siblings, kid('n', 1993))).toEqual(['a', 'n', 'b', 'c']);
    expect(orderWithNewChild(siblings, kid('n', 1995, 2, 1))).toEqual(['a', 'n', 'b', 'c']);
    expect(orderWithNewChild(siblings, kid('n', 1995, 3, 2))).toEqual(['a', 'b', 'n', 'c']);
    expect(orderWithNewChild(siblings, kid('n', 1980))).toEqual(['n', 'a', 'b', 'c']);
  });

  it('út nhất hoặc chưa biết năm sinh thì ở cuối', () => {
    expect(orderWithNewChild(siblings, kid('n', 2010))).toEqual(['a', 'b', 'c', 'n']);
    expect(orderWithNewChild(siblings, kid('n', null))).toEqual(['a', 'b', 'c', 'n']);
  });

  it('anh chị em chưa biết năm sinh không chặn đường chèn; không có anh chị em thì chỉ có con mới', () => {
    expect(orderWithNewChild([kid('x', null), kid('c', 2000)], kid('n', 1999))).toEqual(['x', 'n', 'c']);
    expect(orderWithNewChild([], kid('n', 1999))).toEqual(['n']);
  });
});

describe('childOrderPlan: có cần ghi lại Thứ tự con sau khi thêm con không', () => {
  const kid = (id: string, year: number | null, order: number | null) => person(id, { birth_year: year, birth_order: order });

  it('con mới sinh sau cùng và mọi anh chị em đã có Thứ tự: database đã xếp đúng (lớn nhất + 1), không cần ghi', () => {
    const plan = childOrderPlan([kid('a', 1990, 1), kid('b', 1992, 2)], kid('n', 2000, null));
    expect(plan).toEqual({ ordered: ['a', 'b', 'n'], needsWrite: false });
  });

  it('anh chị em chưa ghi Thứ tự (nhập Excel để trống): con mới sinh sau cùng vẫn phải ghi lại, nếu không nhận Thứ tự 1 và đứng đầu', () => {
    const plan = childOrderPlan([kid('a', 1990, null), kid('b', 1992, null)], kid('n', 2000, null));
    expect(plan.ordered).toEqual(['a', 'b', 'n']);
    expect(plan.needsWrite).toBe(true);
  });

  it('con mới sinh trước anh chị em: ghi lại, con mới đứng đầu', () => {
    const plan = childOrderPlan([kid('a', 1990, 1), kid('b', 1992, 2)], kid('n', 1985, null));
    expect(plan).toEqual({ ordered: ['n', 'a', 'b'], needsWrite: true });
  });

  it('con đầu tiên (chưa có anh chị em): không cần ghi', () => {
    expect(childOrderPlan([], kid('n', 2000, null))).toEqual({ ordered: ['n'], needsWrite: false });
  });
});
