import { fromJulianDay, julianDay, lunarToSolar } from '@gia-pha/lunar';
import { describe, expect, it } from 'vitest';
import type { CalendarSource } from './occurrences';
import { bellReminders, digestOccurrences } from './reminder-policy';

const giỗ = lunarToSolar({ year: 2026, month: 3, day: 12, leap: false })!;
const source = (): CalendarSource => ({
  trees: [{ id: 't1', name: 'Họ Phạm' }],
  persons: [
    { id: 'p1', tree_id: 't1', full_name: 'Cụ A', is_deceased: true, anniversary_day: 12, anniversary_month: 3, birth_solar_date: null },
    { id: 'p2', tree_id: 't1', full_name: 'Cụ B', is_deceased: true, anniversary_day: 12, anniversary_month: 3, birth_solar_date: null },
  ],
  events: [],
});
const daysBefore = (n: number) => fromJulianDay(julianDay(giỗ) - n);
const muted = new Set<string>();

describe('bellReminders', () => {
  it('mặc định nhắc đúng ngày giỗ, không nhắc sớm hơn', () => {
    const prefs = new Map([['t1', { offsetDays: 0, tienThuong: false }]]);
    expect(bellReminders({ source: source(), today: giỗ, mutedPersonIds: muted, prefsByTree: prefs })).toHaveLength(2);
    expect(bellReminders({ source: source(), today: daysBefore(1), mutedPersonIds: muted, prefsByTree: prefs })).toHaveLength(0);
  });

  it('độ sớm 3 ngày nhắc từ 3 ngày trước giỗ', () => {
    const prefs = new Map([['t1', { offsetDays: 3, tienThuong: false }]]);
    expect(bellReminders({ source: source(), today: daysBefore(3), mutedPersonIds: muted, prefsByTree: prefs })).toHaveLength(2);
    expect(bellReminders({ source: source(), today: daysBefore(4), mutedPersonIds: muted, prefsByTree: prefs })).toHaveLength(0);
  });

  it('Tiên thường: nhắc vào hôm trước giỗ (kể cả khi độ sớm là đúng ngày), và tắt nhắc của Người tắt luôn cả hai', () => {
    const prefs = new Map([['t1', { offsetDays: 0, tienThuong: true }]]);
    const eve = bellReminders({ source: source(), today: daysBefore(1), mutedPersonIds: muted, prefsByTree: prefs });
    expect(eve.map((r) => r.occurrence.title).sort()).toEqual(['Tiên thường — Giỗ Cụ A', 'Tiên thường — Giỗ Cụ B']);
    const withMute = bellReminders({ source: source(), today: daysBefore(1), mutedPersonIds: new Set(['p1']), prefsByTree: prefs });
    expect(withMute.map((r) => r.occurrence.personId)).toEqual(['p2']);
  });

  it('gia phả chưa đặt gì: đúng ngày, không Tiên thường', () => {
    expect(bellReminders({ source: source(), today: daysBefore(1), mutedPersonIds: muted, prefsByTree: new Map() })).toHaveLength(0);
    expect(bellReminders({ source: source(), today: giỗ, mutedPersonIds: muted, prefsByTree: new Map() })).toHaveLength(2);
  });
});

describe('digestOccurrences', () => {
  it('cửa sổ gồm hôm nay và days-1 ngày sau, không lọc theo tài khoản', () => {
    expect(digestOccurrences(source(), daysBefore(4), 5)).toHaveLength(2);
    expect(digestOccurrences(source(), daysBefore(5), 5)).toHaveLength(0);
    expect(digestOccurrences(source(), giỗ, 5)).toHaveLength(2);
  });
});
