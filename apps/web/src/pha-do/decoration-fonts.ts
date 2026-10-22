/**
 * Phông chữ của phần trang trí (tiêu đề, phụ đề, câu đối). Mỗi phông có file TTF trong public/fonts (nhúng khi xuất PDF/PNG) và
 * được nạp để xem trước qua Google Fonts trong index.html. Phông chỉ có một độ đậm (chỉ đậm hoặc chỉ thường) thì mọi chữ dùng phông đó
 * tự lấy độ đậm có sẵn (xem `resolveBold`).
 */
export type DecorFontId =
  | 'noto-serif'
  | 'be-vietnam-pro'
  | 'noto-serif-display'
  | 'playfair'
  | 'montserrat'
  | 'roboto-slab'
  | 'dancing-script'
  | 'great-vibes'
  | 'lora';

type DecorFont = {
  label: string;
  /** CSS font-family để xem trước trên trang. */
  css: string;
  regular?: string;
  bold?: string;
  /**
   * Hệ số cỡ chữ tiêu đề: chữ rộng (Montserrat) nhỏ bớt, chữ viết tay (Dancing Script, Great Vibes) to lên để cùng "mắt nhìn"
   * với chữ có chân ở cùng cỡ đặt.
   */
  titleScale: number;
};

export const DECOR_FONTS: Record<DecorFontId, DecorFont> = {
  'noto-serif': { label: 'Noto Serif', css: "'Noto Serif', serif", regular: '/fonts/NotoSerif-400Regular.ttf', bold: '/fonts/NotoSerif-700Bold.ttf', titleScale: 1 },
  'be-vietnam-pro': {
    label: 'Be Vietnam Pro',
    css: "'Be Vietnam Pro', sans-serif",
    regular: '/fonts/BeVietnamPro-400Regular.ttf',
    bold: '/fonts/BeVietnamPro-700Bold.ttf',
    titleScale: 0.95,
  },
  'noto-serif-display': { label: 'Noto Serif Display', css: "'Noto Serif Display', serif", bold: '/fonts/NotoSerifDisplay-700Bold.ttf', titleScale: 1 },
  playfair: { label: 'Playfair Display', css: "'Playfair Display', serif", bold: '/fonts/PlayfairDisplay-700Bold.ttf', titleScale: 1 },
  montserrat: { label: 'Montserrat', css: "'Montserrat', sans-serif", bold: '/fonts/Montserrat-700Bold.ttf', titleScale: 0.92 },
  'roboto-slab': { label: 'Roboto Slab', css: "'Roboto Slab', serif", regular: '/fonts/RobotoSlab-400Regular.ttf', bold: '/fonts/RobotoSlab-700Bold.ttf', titleScale: 0.95 },
  'dancing-script': { label: 'Dancing Script', css: "'Dancing Script', cursive", bold: '/fonts/DancingScript-700Bold.ttf', titleScale: 1.3 },
  'great-vibes': { label: 'Great Vibes', css: "'Great Vibes', cursive", regular: '/fonts/GreatVibes-400Regular.ttf', titleScale: 1.5 },
  lora: { label: 'Lora', css: "'Lora', serif", regular: '/fonts/Lora-400Regular.ttf', bold: '/fonts/Lora-700Bold.ttf', titleScale: 1 },
};

/** Độ đậm thật dùng được cho phông: có cả hai thì theo ý muốn, chỉ có một thì dùng độ đậm đó. */
export const resolveBold = (font: DecorFontId, wantBold: boolean): boolean => {
  const { regular, bold } = DECOR_FONTS[font];
  if (regular && bold) return wantBold;
  return bold !== undefined;
};

/** File TTF của một mặt chữ (phông, độ đậm đã qua `resolveBold`). */
export const decorFaceFile = (font: DecorFontId, bold: boolean): string => {
  const { regular, bold: boldFile } = DECOR_FONTS[font];
  return (bold ? boldFile : regular) ?? (boldFile ?? regular)!;
};

/** Các mặt chữ trang trí mà một bản vẽ dùng, để chỉ nạp và nhúng đúng những file cần. */
export const decorFacesUsed = (items: readonly { type: string; font?: DecorFontId; bold?: boolean }[]): { font: DecorFontId; bold: boolean }[] => {
  const seen = new Map<string, { font: DecorFontId; bold: boolean }>();
  for (const item of items) {
    if (item.type !== 'text' || !item.font) continue;
    const bold = resolveBold(item.font, item.bold === true);
    seen.set(`${item.font}:${bold}`, { font: item.font, bold });
  }
  return [...seen.values()];
};
