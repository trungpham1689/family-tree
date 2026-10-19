import type { Occurrence } from '@gia-pha/reminders';
import { describe, expect, it } from 'vitest';
import { renderDigestHtml, renderDigestText } from './render-email.ts';

const occurrence = (extra: Partial<Occurrence>): Occurrence => ({
  date: { year: 2026, month: 3, day: 12 },
  kind: 'gio',
  title: 'Giỗ Tổ',
  detail: 'Ngày 12 tháng 3 ÂL',
  treeId: 't1',
  treeName: 'Họ Phạm',
  personId: 'p1',
  ...extra,
});

describe('renderDigestText/Html', () => {
  it('liệt kê từng nhắc nhở kèm ngày', () => {
    const text = renderDigestText([occurrence({})]);
    expect(text).toContain('Giỗ Tổ — Ngày 12 tháng 3 ÂL (Thứ năm, 12/3/2026)');
  });

  it('thoát ký tự HTML trong tiêu đề', () => {
    const html = renderDigestHtml([occurrence({ title: '<script>x</script>' })], 'https://example.com');
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('https://example.com/nhac-gio');
  });

  it('tách giỗ, sinh nhật, sự kiện thành các khối riêng, chỉ hiện khối có dữ liệu', () => {
    const items = [
      occurrence({ kind: 'sinh_nhat', title: 'Sinh nhật Bé An', detail: 'Tròn 5 tuổi', date: { year: 2026, month: 3, day: 14 } }),
      occurrence({}),
    ];
    const html = renderDigestHtml(items, 'https://example.com');
    expect(html.indexOf('Ngày giỗ (1)')).toBeGreaterThan(-1);
    expect(html.indexOf('Sinh nhật (1)')).toBeGreaterThan(html.indexOf('Ngày giỗ (1)'));
    expect(html).not.toContain('Sự kiện (');
    expect(html).not.toContain('Kỷ niệm cưới (');
    expect(html).toContain('Họ Phạm');

    const text = renderDigestText(items);
    expect(text).toContain('NGÀY GIỖ (1)');
    expect(text).toContain('SINH NHẬT (1)');
    expect(text).not.toContain('SỰ KIỆN');
  });
});
