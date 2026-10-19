import { describe, expect, it } from 'vitest';
import { feedToIcs } from './feed';

describe('feedToIcs', () => {
  it('lịch đăng ký có tên, chuông báo, giỗ / sinh nhật / kỷ niệm cưới / sự kiện trong 400 ngày tới', () => {
    const ics = feedToIcs(
      {
        trees: [{ id: 't1', name: 'Họ Phạm' }],
        persons: [{ id: 'p1', tree_id: 't1', full_name: 'Bé An', is_deceased: false, anniversary_day: null, anniversary_month: null, birth_solar_date: '2020-11-01' }],
        events: [{ id: 'e1', tree_id: 't1', title: 'Họp họ', calendar: 'duong', repeats_yearly: true, year: null, month: 11, day: 5, leap: false, start_time: null, location: null }],
        marriages: [{ id: 'u1', tree_id: 't1', partner_a: 'p1', names: 'A & B', marriage_year: 1990, marriage_month: 11, marriage_day: 9 }],
      },
      { year: 2026, month: 10, day: 19 },
      new Date('2026-10-19T00:00:00Z'),
    );
    expect(ics).toContain('X-WR-CALNAME:Gia Phả');
    expect(ics).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT12H');
    expect(ics).toContain('SUMMARY:Sinh nhật Bé An');
    expect(ics).toContain('SUMMARY:Họp họ');
    expect(ics).toContain('SUMMARY:Kỷ niệm cưới A & B');
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2 * ics.match(/BEGIN:VEVENT/g)!.length);
    expect(ics).toContain('TRIGGER:-PT15H');
  });
});
