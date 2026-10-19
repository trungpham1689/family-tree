import { describe, expect, it } from 'vitest';
import { cardTitle, injectOpenGraph } from './og-meta';

const html = '<html><head><title>Gia Phả</title></head><body></body></html>';

describe('thẻ xem trước khi dán link', () => {
  it('có tiêu đề gia phả, mô tả và ảnh', () => {
    const out = injectOpenGraph(html, { name: 'Họ Phạm', description: null, persons: 312 }, 'https://a.vn/p/x', 'https://a.vn');
    expect(out).toContain('<title>Gia phả Họ Phạm</title>');
    expect(out).toContain('og:title" content="Gia phả Họ Phạm"');
    expect(out).toContain('312 người');
    expect(out).toContain('og:image" content="https://a.vn/og-gia-pha.png"');
  });

  it('không lặp chữ "gia phả" và chống chèn HTML', () => {
    expect(cardTitle({ name: 'Gia phả họ Lê', description: null, persons: 1 })).toBe('Gia phả họ Lê');
    const out = injectOpenGraph(html, { name: '"><script>x</script>', description: null, persons: 1 }, 'https://a.vn', 'https://a.vn');
    expect(out).not.toContain('<script>');
  });

  it('tên gia phả chứa mẫu thay thế "$&" / "$\'" thì giữ nguyên chữ, không phá trang', () => {
    const out = injectOpenGraph(html, { name: "A $& B $' C", description: null, persons: 1 }, 'https://a.vn', 'https://a.vn');
    expect(out).toContain("Gia phả A $&amp; B $' C");
    expect(out.match(/<\/head>/g)).toHaveLength(1);
  });

  it('thay thẻ mặc định của index.html thay vì thêm trùng, và không cho lập chỉ mục', () => {
    const base = '<head><meta name="robots" content="noindex" />\n<meta property="og:title" content="Gia Phả" />\n<meta name="description" content="x" />\n<title>Gia Phả</title></head>';
    const out = injectOpenGraph(base, { name: 'Họ Phạm', description: null, persons: 3 }, 'https://a.vn/p/x', 'https://a.vn');
    expect(out.match(/og:title/g)).toHaveLength(1);
    expect(out.match(/name="description"/g)).toHaveLength(1);
    expect(out.match(/name="robots"/g)).toHaveLength(1);
    expect(out).toContain('name="robots" content="noindex');
  });

  it('link hết hiệu lực vẫn có thẻ, không lộ gì', () => {
    expect(injectOpenGraph(html, null, 'https://a.vn/p/x', 'https://a.vn')).toContain('không còn hiệu lực');
  });
});
