import { describe, expect, it } from 'vitest';
import type { Occurrence } from './occurrences';
import { dueReminders, notificationKey } from './due-reminders';

const occurrence = (extra: Partial<Occurrence>): Occurrence => ({
  date: { year: 2026, month: 3, day: 12 },
  kind: 'gio',
  title: 'Giỗ Tổ',
  detail: '',
  treeId: 't1',
  treeName: 'Họ Phạm',
  personId: 'p1',
  ...extra,
});

const today = { year: 2026, month: 3, day: 10 };
const noneMuted = new Set<string>();

describe('dueReminders', () => {
  it('giỗ mặc định nhắc cho mọi Người (không ai bị tắt)', () => {
    const occurrences = [occurrence({ personId: 'p1' }), occurrence({ personId: 'p2' })];
    const result = dueReminders(occurrences, today, noneMuted, new Map([['t1', 7]]));
    expect(result).toHaveLength(2);
  });

  it('giỗ không nhắc Người đã có trong Danh sách tắt nhắc', () => {
    const occurrences = [occurrence({ personId: 'p1' }), occurrence({ personId: 'p2' })];
    const result = dueReminders(occurrences, today, new Set(['p1']), new Map([['t1', 7]]));
    expect(result).toHaveLength(1);
    expect(result[0]!.occurrence.personId).toBe('p2');
  });

  it('sinh nhật và Sự kiện không lọc theo Danh sách tắt nhắc', () => {
    const occurrences = [
      occurrence({ kind: 'sinh_nhat', personId: 'p1' }),
      occurrence({ kind: 'su_kien', personId: undefined, eventId: 'e1' }),
    ];
    const result = dueReminders(occurrences, today, new Set(['p1']), new Map([['t1', 7]]));
    expect(result).toHaveLength(2);
  });

  it('chỉ lấy trong khoảng 0..offset ngày tới, không lấy ngày đã qua', () => {
    const past = occurrence({ date: { year: 2026, month: 3, day: 1 } }); // đã qua
    const today3 = occurrence({ date: { year: 2026, month: 3, day: 13 } }); // 3 ngày tới
    const today8 = occurrence({ date: { year: 2026, month: 3, day: 18 } }); // 8 ngày tới

    expect(dueReminders([past], today, noneMuted, new Map([['t1', 7]]))).toHaveLength(0);
    expect(dueReminders([today3], today, noneMuted, new Map([['t1', 3]]))).toHaveLength(1);
    expect(dueReminders([today8], today, noneMuted, new Map([['t1', 7]]))).toHaveLength(0);
  });

  it('không có cài đặt riêng cho gia phả thì mặc định đúng ngày (offset 0)', () => {
    const dueToday = occurrence({ date: today });
    const dueTomorrow = occurrence({ date: { year: 2026, month: 3, day: 11 } });
    expect(dueReminders([dueToday], today, noneMuted, new Map())).toHaveLength(1);
    expect(dueReminders([dueTomorrow], today, noneMuted, new Map())).toHaveLength(0);
  });

  it('sắp xếp theo gần đến hạn nhất trước', () => {
    const far = occurrence({ date: { year: 2026, month: 3, day: 17 } });
    const near = occurrence({ date: { year: 2026, month: 3, day: 11 } });
    const result = dueReminders([far, near], today, noneMuted, new Map([['t1', 7]]));
    expect(result.map((r) => r.dueInDays)).toEqual([1, 7]);
  });

  it('khoá nhắc nhở ổn định theo loại, Người/Sự kiện và ngày', () => {
    expect(notificationKey(occurrence({ personId: 'p1' }))).toBe('gio:p1:2026-3-12');
    expect(notificationKey(occurrence({ kind: 'su_kien', personId: undefined, eventId: 'e1' }))).toBe('su_kien:e1:2026-3-12');
  });
});
