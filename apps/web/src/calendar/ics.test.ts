import { describe, expect, it } from 'vitest';
import { occurrencesToIcs } from './ics';
import type { Occurrence } from '@gia-pha/reminders';

const occurrence = (over: Partial<Occurrence> = {}): Occurrence => ({
  date: { year: 2026, month: 3, day: 1 },
  kind: 'gio',
  title: 'Giỗ Phạm Văn Tổ',
  detail: 'Ngày 12 tháng 3 âm lịch',
  treeId: 't1',
  treeName: 'Họ Phạm',
  personId: 'p1',
  ...over,
});

const NOW = new Date('2026-01-01T00:00:00Z');

describe('occurrencesToIcs', () => {
  it('bọc đúng khung VCALENDAR', () => {
    const ics = occurrencesToIcs([occurrence()], NOW);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR')).toBe(true);
  });

  it('sự kiện cả ngày: DTEND là ngày hôm sau', () => {
    const ics = occurrencesToIcs([occurrence({ date: { year: 2026, month: 3, day: 1 } })], NOW);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260301');
    expect(ics).toContain('DTEND;VALUE=DATE:20260302');
  });

  it('DTEND vượt sang tháng/năm sau vẫn đúng', () => {
    const ics = occurrencesToIcs([occurrence({ date: { year: 2026, month: 12, day: 31 } })], NOW);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231');
    expect(ics).toContain('DTEND;VALUE=DATE:20270101');
  });

  it('thoát dấu phẩy, chấm phẩy trong tiêu đề', () => {
    const ics = occurrencesToIcs([occurrence({ title: 'Họp họ; ăn cơm, uống trà' })], NOW);
    expect(ics).toContain('SUMMARY:Họp họ\\; ăn cơm\\, uống trà');
  });

  it('xuống dòng (kể cả CR) trong tiêu đề không chèn được dòng mới vào file .ics', () => {
    const ics = occurrencesToIcs([occurrence({ title: 'A\r\nATTENDEE:evil\rB' })], new Date('2026-01-01T00:00:00Z'));
    expect(ics).toContain('SUMMARY:A\\nATTENDEE:evil\\nB');
    expect(ics.split('\r\n').some((line) => line.startsWith('ATTENDEE'))).toBe(false);
  });

  it('mỗi dịp có UID riêng, không trùng nhau', () => {
    const ics = occurrencesToIcs(
      [occurrence({ personId: 'a' }), occurrence({ personId: 'b' })],
      NOW,
    );
    const uids = [...ics.matchAll(/UID:(.+)/g)].map((m) => m[1]);
    expect(new Set(uids).size).toBe(2);
  });
});
