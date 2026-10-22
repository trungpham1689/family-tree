import type { DecorFontId } from './decoration-fonts';
import type { FrameStyle } from './decoration';

/**
 * Bốn phương án trang trí cho mỗi kiểu khung: nền giấy, màu tiêu đề, màu chữ phụ/câu đối và cặp phông (tiêu đề + chữ phụ/câu đối).
 * A theo truyền thống, B thanh lịch (chữ không chân, giấy sáng), C trang trọng (giấy ngà đậm, tiêu đề nét đậm), D thư pháp (tiêu đề chữ viết tay).
 * Mọi chữ đạt tương phản từ 7:1 với nền (`decoration.test.ts` kiểm tra).
 */
export type DecorLook = 'A' | 'B' | 'C' | 'D';

export const DECOR_LOOKS: readonly DecorLook[] = ['A', 'B', 'C', 'D'];

export const LOOK_LABELS: Record<DecorLook, string> = {
  A: 'Truyền thống',
  B: 'Thanh lịch',
  C: 'Trang trọng',
  D: 'Thư pháp',
};

export type LookStyle = {
  background: string;
  title: string;
  text: string;
  titleFont: DecorFontId;
  bodyFont: DecorFontId;
};

const look = (background: string, title: string, text: string, titleFont: DecorFontId, bodyFont: DecorFontId): LookStyle => ({
  background,
  title,
  text,
  titleFont,
  bodyFont,
});

export const LOOK_STYLES: Record<FrameStyle, Record<DecorLook, LookStyle>> = {
  'son-kim': {
    A: look('#fbf2dc', '#8a1c1c', '#5a2a12', 'noto-serif-display', 'noto-serif'),
    B: look('#f8f2e6', '#7a1717', '#3d3835', 'montserrat', 'be-vietnam-pro'),
    C: look('#f6e6bd', '#7a1212', '#4a2008', 'playfair', 'noto-serif'),
    D: look('#f3e6c9', '#6b1f14', '#4a2f1c', 'great-vibes', 'noto-serif'),
  },
  moc: {
    A: look('#efe3d0', '#4a3018', '#5a4128', 'lora', 'lora'),
    B: look('#f1ebdf', '#3a2a1c', '#4a4038', 'montserrat', 'be-vietnam-pro'),
    C: look('#e6d3b4', '#3a2210', '#4a3018', 'roboto-slab', 'lora'),
    D: look('#f1e4c8', '#5b3a1c', '#4a3622', 'dancing-script', 'lora'),
  },
  'thanh-nha': {
    A: look('#fbfaf7', '#1f1a17', '#4a4540', 'playfair', 'be-vietnam-pro'),
    B: look('#f2f0ec', '#1a1714', '#4a4540', 'montserrat', 'be-vietnam-pro'),
    C: look('#efebe3', '#1a1714', '#3a3530', 'noto-serif-display', 'noto-serif'),
    D: look('#f3eee2', '#2b2118', '#4a4034', 'dancing-script', 'lora'),
  },
  'lam-ngoc': {
    A: look('#e8f3ef', '#1a4a42', '#24504a', 'lora', 'lora'),
    B: look('#edf5f2', '#14403a', '#33524c', 'be-vietnam-pro', 'be-vietnam-pro'),
    C: look('#d8ece5', '#0f3a33', '#1f4a42', 'playfair', 'lora'),
    D: look('#e9efe0', '#1f4a42', '#34503c', 'dancing-script', 'lora'),
  },
  'hoang-gia': {
    A: look('#f4ecf8', '#4a1f6e', '#4a2570', 'playfair', 'noto-serif'),
    B: look('#f2edf6', '#3d1a5c', '#4b3a5e', 'montserrat', 'be-vietnam-pro'),
    C: look('#e9dcf2', '#3a1259', '#3a1a57', 'noto-serif-display', 'lora'),
    D: look('#efe6ee', '#4a2060', '#43304f', 'great-vibes', 'noto-serif'),
  },
  'trieu-nguyen': {
    A: look('#f3e4d6', '#5c1414', '#4a2a12', 'noto-serif-display', 'noto-serif'),
    B: look('#f7efe7', '#5c1414', '#44342a', 'be-vietnam-pro', 'be-vietnam-pro'),
    C: look('#eed9c0', '#4a0e0e', '#3e1f0c', 'playfair', 'noto-serif'),
    D: look('#f0e0c8', '#6a1a14', '#4a3220', 'dancing-script', 'noto-serif'),
  },
  'tram-huong': {
    A: look('#ede1cf', '#3e2a14', '#5a4228', 'lora', 'lora'),
    B: look('#f3eee4', '#33220f', '#4b4036', 'montserrat', 'be-vietnam-pro'),
    C: look('#e2d0b3', '#2b1a08', '#3e2c18', 'roboto-slab', 'lora'),
    D: look('#eee0c4', '#4b3219', '#4a3a28', 'dancing-script', 'lora'),
  },
  'cuon-thu': {
    A: look('#f1e3c3', '#5a3a1f', '#4a3018', 'dancing-script', 'noto-serif'),
    B: look('#f5eddc', '#4a2e16', '#4a3d2e', 'be-vietnam-pro', 'be-vietnam-pro'),
    C: look('#e8d3a5', '#3e2410', '#43301c', 'playfair', 'noto-serif'),
    D: look('#efdfb8', '#5a3a1f', '#3e2c18', 'great-vibes', 'noto-serif'),
  },
  'hoanh-phi': {
    A: look('#f8ecd2', '#8a1c1c', '#5a2a12', 'roboto-slab', 'roboto-slab'),
    B: look('#fbf3e1', '#7a1818', '#4a3a30', 'montserrat', 'be-vietnam-pro'),
    C: look('#f2dfae', '#6e1010', '#4a2208', 'noto-serif-display', 'roboto-slab'),
    D: look('#f4e4c2', '#7a1a14', '#4a3220', 'dancing-script', 'noto-serif'),
  },
  'dong-son': {
    A: look('#eee6d0', '#1f4a3e', '#3b2a14', 'roboto-slab', 'roboto-slab'),
    B: look('#f2f0e2', '#17382f', '#3e4a44', 'be-vietnam-pro', 'be-vietnam-pro'),
    C: look('#dde5d3', '#0f3a2c', '#2a3a30', 'noto-serif-display', 'roboto-slab'),
    D: look('#ece0c6', '#2a4a3a', '#43331c', 'dancing-script', 'lora'),
  },
  'gam-hoa': {
    A: look('#fffdf7', '#8a1c1c', '#5a2a12', 'noto-serif-display', 'noto-serif'),
    B: look('#ffffff', '#7a1818', '#4a3a30', 'montserrat', 'be-vietnam-pro'),
    C: look('#f8ebca', '#6e1010', '#4a2208', 'playfair', 'noto-serif'),
    D: look('#f5e9d0', '#7a1a14', '#4a3220', 'great-vibes', 'noto-serif'),
  },
  none: {
    A: look('#ffffff', '#8a1c1c', '#1f1a17', 'noto-serif', 'noto-serif'),
    B: look('#ffffff', '#1a1714', '#4a4540', 'montserrat', 'be-vietnam-pro'),
    C: look('#ffffff', '#6e1010', '#3a2208', 'playfair', 'noto-serif'),
    D: look('#ffffff', '#5a1f14', '#4a3220', 'dancing-script', 'noto-serif'),
  },
};

/**
 * Màu ô thành viên theo khung, kiểu "Cổ điển" (đúng bản thiết kế docs/Ô thành viên theo kiểu khung.pdf): nền ô nam sáng ngả theo giấy của khung,
 * nền ô Dâu/Rể đậm hơn một nấc cùng tông; tên gần như đen ngả tông khung, chi tiết nhạt hơn một bậc, nhãn hôn phối theo màu khung.
 */
export type MemberColors = { fill: string; spouse: string; name: string; detail: string; note: string };

export const MEMBER_COLORS: Record<FrameStyle, MemberColors> = {
  'son-kim': { fill: '#fffaf0', spouse: '#f7ecd0', name: '#3b1a0c', detail: '#6b3a1e', note: '#8a1c1c' },
  moc: { fill: '#fbf6ec', spouse: '#f1e6d2', name: '#3a2511', detail: '#5e442a', note: '#7a2e1a' },
  'thanh-nha': { fill: '#ffffff', spouse: '#f4f2ee', name: '#1a1714', detail: '#55504a', note: '#7a2020' },
  'lam-ngoc': { fill: '#f7fcfa', spouse: '#d9ebe5', name: '#123a34', detail: '#2f5d55', note: '#6b2c2c' },
  'hoang-gia': { fill: '#fdfaff', spouse: '#e9ddf1', name: '#2e1247', detail: '#5b3a7a', note: '#7a1f4a' },
  'trieu-nguyen': { fill: '#fffaf4', spouse: '#f1dfcc', name: '#3e0f0f', detail: '#6a3a1c', note: '#5c1414' },
  'tram-huong': { fill: '#faf4e9', spouse: '#e7d9c2', name: '#33210f', detail: '#5e4730', note: '#6b3a14' },
  'cuon-thu': { fill: '#faf1da', spouse: '#ebdab3', name: '#3e2812', detail: '#664a2c', note: '#7a3a1a' },
  'hoanh-phi': { fill: '#fffaf0', spouse: '#f2e1bd', name: '#3d1a0c', detail: '#6b3a1e', note: '#8a1c1c' },
  'dong-son': { fill: '#f9f5e6', spouse: '#e3dfc6', name: '#17382f', detail: '#3f5a50', note: '#5c3a14' },
  'gam-hoa': { fill: '#fffaf0', spouse: '#f6e8c8', name: '#3b1a0c', detail: '#6b3a1e', note: '#8a1c1c' },
  // Không khung: màu mặc định của Phả đồ từ trước.
  none: { fill: '#ffffff', spouse: '#fbf8f3', name: '#1f1a17', detail: '#5c534c', note: '#8a1c1c' },
};

/** Phông chữ trong ô thành viên theo khung (khi chọn "Theo kiểu khung"): chữ có chân hoặc chữ đế dày, đọc rõ ở 14 px (10,5 pt). */
export const MEMBER_FONTS: Record<FrameStyle, DecorFontId> = {
  'son-kim': 'noto-serif',
  moc: 'merriweather',
  'thanh-nha': 'be-vietnam-pro',
  'lam-ngoc': 'lora',
  'hoang-gia': 'source-serif-4',
  'trieu-nguyen': 'noto-serif',
  'tram-huong': 'literata',
  'cuon-thu': 'noto-serif',
  'hoanh-phi': 'roboto-slab',
  'dong-son': 'bitter',
  'gam-hoa': 'source-serif-4',
  none: 'noto-serif',
};
