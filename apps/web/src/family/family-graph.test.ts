import { describe, expect, it } from 'vitest';
import { buildFamilyGraph, type GraphPerson } from './family-graph';

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

  it('liệt kê Người chưa nối', () => {
    expect(sample().unconnected().map((p) => p.id)).toEqual(['lac']);
    expect(sample().placement('lac')).toEqual({ generation: null, branchId: null, kind: 'chua_noi' });
  });

  it('Người không có trong kết quả vị trí coi như chưa nối', () => {
    const graph = buildFamilyGraph({ persons: [person('x')], parentLinks: [], unions: [], positions: [] });
    expect(graph.placement('x').kind).toBe('chua_noi');
  });
});
