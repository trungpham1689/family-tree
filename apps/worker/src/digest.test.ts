import { fromJulianDay, julianDay, lunarToSolar, type SolarDate } from '@gia-pha/lunar';
import type { CalendarPerson, CalendarSource } from '@gia-pha/reminders';
import { describe, expect, it } from 'vitest';
import { buildDigests, isDigestDay } from './digest.ts';

// Giỗ lưu theo ngày âm (12/3); tính sẵn ngày dương thật của năm 2026 để "hôm nay" luôn trong khoảng
// đến hạn, không đoán ngày dương bừa (âm 12/3 không rơi đúng vào dương 12/3).
const anniversarySolar = lunarToSolar({ year: 2026, month: 3, day: 12, leap: false })!;
const today: SolarDate = fromJulianDay(julianDay(anniversarySolar) - 2);

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

const recipients = new Map([['t1', ['chu@example.com', 'bientap@example.com']]]);

describe('buildDigests', () => {
  it('một email cho cả gia phả, gửi chung cho mọi người nhận', () => {
    const digests = buildDigests({ today, source: source(), recipientsByTree: recipients });
    expect(digests).toHaveLength(1);
    expect(digests[0]).toMatchObject({ treeId: 't1', treeName: 'Họ Phạm', emails: ['chu@example.com', 'bientap@example.com'] });
    expect(digests[0]!.occurrences).toHaveLength(1);
  });

  it('gia phả không có người nhận thì không gửi', () => {
    expect(buildDigests({ today, source: source(), recipientsByTree: new Map() })).toHaveLength(0);
  });

  it('không có giỗ/sự kiện trong 5 ngày tới thì không gửi', () => {
    expect(buildDigests({ today, source: source({ persons: [], events: [] }), recipientsByTree: recipients })).toHaveLength(0);
    const far = fromJulianDay(julianDay(anniversarySolar) + 10);
    expect(buildDigests({ today: far, source: source(), recipientsByTree: recipients })).toHaveLength(0);
  });

  it('sinh nhật của người còn sống vào email, tách khỏi giỗ', () => {
    const birthday = `1990-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;
    const digests = buildDigests({
      today,
      source: source({ persons: [person({}), person({ id: 'p2', full_name: 'Bé An', is_deceased: false, anniversary_day: null, anniversary_month: null, birth_solar_date: birthday })] }),
      recipientsByTree: recipients,
    });
    expect(digests[0]!.occurrences.map((o) => o.kind).sort()).toEqual(['gio', 'sinh_nhat']);
  });

  it('mỗi ngày giỗ nằm trong đúng một kỳ 5 ngày (không sót, không gửi hai lần)', () => {
    const base = julianDay(anniversarySolar) - 12;
    const sendDays = Array.from({ length: 25 }, (_, i) => fromJulianDay(base + i)).filter(isDigestDay);
    const hits = sendDays.filter((day) => buildDigests({ today: day, source: source(), recipientsByTree: recipients }).length > 0);
    expect(hits).toHaveLength(1);
  });
});

describe('isDigestDay', () => {
  it('cứ 5 ngày đúng một lần', () => {
    const start = julianDay({ year: 2026, month: 10, day: 1 });
    const days = Array.from({ length: 30 }, (_, i) => fromJulianDay(start + i)).filter(isDigestDay);
    expect(days).toHaveLength(6);
    for (let i = 1; i < days.length; i += 1) expect(julianDay(days[i]!) - julianDay(days[i - 1]!)).toBe(5);
  });
});
