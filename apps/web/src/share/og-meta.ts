/**
 * Thẻ Open Graph cho link chia sẻ công khai: khi dán link vào Zalo/Facebook, máy của họ đọc HTML
 * (không chạy JavaScript), nên tiêu đề và ảnh phải có sẵn trong HTML trả về.
 * Chỉ dùng tên gia phả và số người — không có thông tin của từng Người.
 */

export type PublicCard = { name: string; description: string | null; persons: number };

const escapeHtml = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export const cardTitle = (card: PublicCard | null) => (card ? `Gia phả ${card.name}`.replace(/^Gia phả gia phả /i, 'Gia phả ') : 'Gia Phả');

export const cardDescription = (card: PublicCard | null) => {
  if (!card) return 'Link chia sẻ gia phả không còn hiệu lực.';
  const base = card.description?.trim() || 'Cây gia phả của dòng họ.';
  return `${base} ${card.persons} người — bấm để xem cây.`.slice(0, 200);
};

/** Các thẻ meta chèn vào <head>. `origin` là tên miền đang phục vụ, ví dụ https://giapha.pages.dev. */
export const openGraphTags = (card: PublicCard | null, pageUrl: string, origin: string): string => {
  const title = escapeHtml(cardTitle(card));
  const description = escapeHtml(cardDescription(card));
  const image = `${origin}/og-gia-pha.png`;
  return [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Gia Phả" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:locale" content="vi_VN" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="description" content="${description}" />`,
  ].join('\n    ');
};

/** Thay <title> và chèn thẻ meta vào HTML của ứng dụng. */
export const injectOpenGraph = (html: string, card: PublicCard | null, pageUrl: string, origin: string): string =>
  html
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(cardTitle(card))}</title>`)
    .replace('</head>', `    ${openGraphTags(card, pageUrl, origin)}\n  </head>`);
