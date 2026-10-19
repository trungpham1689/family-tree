import type { Occurrence, OccurrenceKind } from '@gia-pha/reminders';

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Ba loại nhắc nhở, mỗi loại một khối riêng với màu và tiêu đề riêng để nhìn là phân biệt được ngay. */
const SECTIONS: { kind: OccurrenceKind; icon: string; title: string; hint: string; accent: string; soft: string }[] = [
  { kind: 'gio', icon: '🕯️', title: 'Ngày giỗ', hint: 'Chuẩn bị cúng giỗ', accent: '#8a1c1c', soft: '#fbeeee' },
  { kind: 'sinh_nhat', icon: '🎂', title: 'Sinh nhật', hint: 'Đừng quên gửi lời chúc', accent: '#b45309', soft: '#fff6e5' },
  { kind: 'cuoi', icon: '💍', title: 'Kỷ niệm cưới', hint: 'Chúc mừng ngày cưới', accent: '#7a4a9e', soft: '#f3ecf8' },
  { kind: 'su_kien', icon: '📅', title: 'Sự kiện', hint: 'Họp họ và các ngày đã đặt', accent: '#1f5f8b', soft: '#eaf3fa' },
];

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

const dayMonth = ({ date }: Occurrence) => `${date.day}/${date.month}`;
const weekday = ({ date }: Occurrence) => WEEKDAYS[new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()]!;
const fullDate = (occurrence: Occurrence) => `${weekday(occurrence)}, ${occurrence.date.day}/${occurrence.date.month}/${occurrence.date.year}`;
const byDate = (a: Occurrence, b: Occurrence) =>
  a.date.year - b.date.year || a.date.month - b.date.month || a.date.day - b.date.day || a.title.localeCompare(b.title, 'vi');

const groups = (occurrences: readonly Occurrence[]) =>
  SECTIONS.map((section) => ({ section, items: occurrences.filter((o) => o.kind === section.kind).sort(byDate) })).filter((g) => g.items.length > 0);

const row = (occurrence: Occurrence, accent: string) =>
  `<tr>` +
  `<td width="64" valign="top" style="padding:12px 0 12px 16px;"><div style="background:${accent};color:#ffffff;border-radius:8px;padding:6px 0;text-align:center;font-size:16px;font-weight:700;line-height:1.2;">${dayMonth(occurrence)}</div></td>` +
  `<td valign="top" style="padding:12px 16px;"><div style="font-size:16px;font-weight:600;color:#1f1b16;">${escapeHtml(occurrence.title)}</div>` +
  `<div style="font-size:13px;color:#6b6258;margin-top:2px;">${escapeHtml(fullDate(occurrence))}${occurrence.detail ? ` · ${escapeHtml(occurrence.detail)}` : ''}</div></td>` +
  `</tr>`;

const sectionHtml = ({ section, items }: ReturnType<typeof groups>[number]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid #e5ddd0;border-left:5px solid ${section.accent};border-radius:10px;background:#ffffff;">` +
  `<tr><td colspan="2" style="padding:12px 16px;background:${section.soft};border-radius:10px 10px 0 0;">` +
  `<span style="font-size:17px;font-weight:700;color:${section.accent};">${section.icon} ${section.title} (${items.length})</span>` +
  `<span style="font-size:13px;color:#6b6258;"> — ${section.hint}</span></td></tr>` +
  items.map((item) => row(item, section.accent)).join('') +
  `</table>`;

export const renderDigestHtml = (occurrences: readonly Occurrence[], appUrl: string): string => {
  const treeName = occurrences[0]?.treeName ?? '';
  return (
    `<!doctype html><html lang="vi"><body style="margin:0;padding:0;background:#f6f1e7;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1e7;"><tr><td align="center" style="padding:24px 12px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
    `<tr><td style="background:#8a1c1c;border-radius:12px 12px 0 0;padding:20px 24px;color:#ffffff;">` +
    `<div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;opacity:.85;">Gia Phả</div>` +
    `<div style="font-size:22px;font-weight:700;margin-top:4px;">${escapeHtml(treeName)}</div>` +
    `<div style="font-size:14px;margin-top:4px;opacity:.9;">Nhắc nhở trong 5 ngày tới</div></td></tr>` +
    `<tr><td style="background:#faf7f0;padding:20px 16px 4px;border-radius:0 0 12px 12px;">` +
    groups(occurrences).map(sectionHtml).join('') +
    `<p style="text-align:center;margin:8px 0 20px;"><a href="${escapeHtml(appUrl)}/nhac-gio" style="display:inline-block;background:#8a1c1c;color:#ffffff;text-decoration:none;font-weight:600;border-radius:8px;padding:10px 20px;">Xem trên Gia Phả</a></p>` +
    `</td></tr>` +
    `<tr><td style="padding:12px;text-align:center;font-size:12px;color:#8a8175;">Email gửi tới Chủ sở hữu và Biên tập viên của gia phả. Tắt email nhắc trong trang Nhắc nhở của ứng dụng.</td></tr>` +
    `</table></td></tr></table></body></html>`
  );
};

export const renderDigestText = (occurrences: readonly Occurrence[]): string =>
  [
    `Gia Phả ${occurrences[0]?.treeName ?? ''} — nhắc nhở trong 5 ngày tới`,
    ...groups(occurrences).flatMap(({ section, items }) => [
      '',
      `${section.icon} ${section.title.toUpperCase()} (${items.length}) — ${section.hint}`,
      ...items.map((item) => `- ${dayMonth(item)} · ${item.title}${item.detail ? ` — ${item.detail}` : ''} (${fullDate(item)})`),
    ]),
  ].join('\n');
