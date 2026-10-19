import { fromJulianDay, julianDay, lunarToSolar, type SolarDate } from '@gia-pha/lunar';
import type { CalendarEvent, CalendarPerson, CalendarSource } from '@gia-pha/reminders';
import { describe, expect, it } from 'vitest';
import { buildDigests } from './digest.ts';

// Giỗ lưu theo ngày âm (12/3); tính sẵn ngày dương thật của năm 2026 để "hôm nay" luôn trong khoảng
// đến hạn, không đoán ngày dương bừa (âm 12/3 không rơi đúng vào dương 12/3).
const anniversarySolar = lunarToSolar({ year: 2026, month: 3, day: 12, leap: false })!;
const today: SolarDate = fromJulianDay(julianDay(anniversarySolar) - 2);
const noneMuted = new Map<string, Set<string>>();

const person = (extra: Partial<CalendarPerson>): CalendarPerson => ({
  id: 'p1',
  tree_id: 't1',
  full_name: 'Tổ',
  is_deceased: true,
  anniversary_day: 12,
  anniversary_month: 3,
  birth_solar_date: null,
  ...extra,
});

const source = (extra: Partial<CalendarSource> = {}): CalendarSource => ({
  trees: [{ id: 't1', name: 'Họ Phạm' }],
  persons: [person({})],
  events: [],
  ...extra,
});

describe('buildDigests', () => {
  it('gộp nhắc nhở đến hạn, chưa đọc, chưa tắt email (giỗ mặc định nhắc cho mọi người)', () => {
    const digests = buildDigests({
      today,
      source: source(),
      emailByAccount: new Map([['acc1', 'a@example.com']]),
      treesByAccount: new Map([['acc1', ['t1']]]),
      mutedByAccount: noneMuted,
      prefsByAccount: new Map([['acc1', new Map([['t1', { offsetDays: 3, emailEnabled: true }]])]]),
      readByAccount: new Map(),
    });
    expect(digests).toHaveLength(1);
    expect(digests[0]).toMatchObject({ accountId: 'acc1', email: 'a@example.com' });
    expect(digests[0]!.occurrences).toHaveLength(1);
  });

  it('tắt email ở một gia phả thì không gộp nhắc nhở của gia phả đó', () => {
    const digests = buildDigests({
      today,
      source: source(),
      emailByAccount: new Map([['acc1', 'a@example.com']]),
      treesByAccount: new Map([['acc1', ['t1']]]),
      mutedByAccount: noneMuted,
      prefsByAccount: new Map([['acc1', new Map([['t1', { offsetDays: 3, emailEnabled: false }]])]]),
      readByAccount: new Map(),
    });
    expect(digests).toHaveLength(0);
  });

  it('đã đọc rồi thì không gộp lại', () => {
    const digests = buildDigests({
      today,
      source: source(),
      emailByAccount: new Map([['acc1', 'a@example.com']]),
      treesByAccount: new Map([['acc1', ['t1']]]),
      mutedByAccount: noneMuted,
      prefsByAccount: new Map([['acc1', new Map([['t1', { offsetDays: 3, emailEnabled: true }]])]]),
      readByAccount: new Map([['acc1', new Set([`gio:p1:${anniversarySolar.year}-${anniversarySolar.month}-${anniversarySolar.day}`])]]),
    });
    expect(digests).toHaveLength(0);
  });

  it('đã tắt nhắc giỗ của Người thì giỗ của người đó không vào bản tin', () => {
    const digests = buildDigests({
      today,
      source: source(),
      emailByAccount: new Map([['acc1', 'a@example.com']]),
      treesByAccount: new Map([['acc1', ['t1']]]),
      mutedByAccount: new Map([['acc1', new Set(['p1'])]]),
      prefsByAccount: new Map([['acc1', new Map([['t1', { offsetDays: 7, emailEnabled: true }]])]]),
      readByAccount: new Map(),
    });
    expect(digests).toHaveLength(0);
  });

  it('không có tài khoản nào đến hạn thì không có bản tin nào', () => {
    const noEvent: CalendarEvent[] = [];
    const digests = buildDigests({
      today,
      source: source({ persons: [], events: noEvent }),
      emailByAccount: new Map([['acc1', 'a@example.com']]),
      treesByAccount: new Map([['acc1', ['t1']]]),
      mutedByAccount: noneMuted,
      prefsByAccount: new Map(),
      readByAccount: new Map(),
    });
    expect(digests).toHaveLength(0);
  });
});
