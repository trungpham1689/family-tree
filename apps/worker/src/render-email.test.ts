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
    expect(text).toContain('Giỗ Tổ — Ngày 12 tháng 3 ÂL (12/3/2026)');
  });

  it('thoát ký tự HTML trong tiêu đề', () => {
    const html = renderDigestHtml([occurrence({ title: '<script>x</script>' })], 'https://example.com');
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('https://example.com/nhac-gio');
  });
});
