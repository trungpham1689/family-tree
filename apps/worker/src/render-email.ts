import type { Occurrence } from '@gia-pha/reminders';

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const line = (occurrence: Occurrence) =>
  `${occurrence.title}${occurrence.detail ? ` — ${occurrence.detail}` : ''} (${occurrence.date.day}/${occurrence.date.month}/${occurrence.date.year})`;

export const renderDigestHtml = (occurrences: readonly Occurrence[], appUrl: string): string =>
  [
    '<p>Nhắc nhở từ Gia Phả:</p>',
    '<ul>',
    ...occurrences.map((occurrence) => `<li>${escapeHtml(line(occurrence))}</li>`),
    '</ul>',
    `<p><a href="${appUrl}/nhac-gio">Xem trên Gia Phả</a></p>`,
  ].join('');

export const renderDigestText = (occurrences: readonly Occurrence[]): string =>
  ['Nhắc nhở từ Gia Phả:', ...occurrences.map((occurrence) => `- ${line(occurrence)}`)].join('\n');
