/**
 * Ngắt họ tên thành tối đa `maxLines` dòng, mỗi dòng không quá `maxChars` ký tự,
 * ngắt ở khoảng trắng; phần thừa ở dòng cuối thay bằng "…".
 * Dùng cho chữ SVG (không tự xuống dòng) trong ô của Cây và Phả đồ.
 */
export const wrapName = (name: string, maxChars: number, maxLines = 2): string[] => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  if (lines.length <= maxLines && lines.every((line) => line.length <= maxChars)) return lines;

  const kept = lines.slice(0, maxLines);
  const lastIndex = kept.length - 1;
  const overflow = lines.length > maxLines || kept[lastIndex]!.length > maxChars;
  if (overflow) {
    const last = lines.slice(lastIndex).join(' ');
    kept[lastIndex] = `${last.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
  }
  return kept.map((line, index) => (index < lastIndex && line.length > maxChars ? `${line.slice(0, maxChars - 1)}…` : line));
};
