import { useEffect, useState } from 'react';
import { DEFAULT_DECORATION, layoutDecoration, type FrameStyle } from './decoration';
import { drawingToSvg } from './svg';

const THUMB_PAGE = { width: 297, height: 420 };
const cache = new Map<FrameStyle, string>();

/** Ảnh xem trước một kiểu khung (chỉ khung, không chữ), dựng bằng chính bộ vẽ của Phả đồ nên luôn đúng với bản in. */
const build = (frame: FrameStyle): string => {
  const { below } = layoutDecoration(THUMB_PAGE, { ...DEFAULT_DECORATION, frame }, '');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(drawingToSvg({ ...THUMB_PAGE, items: below }))}`;
};

/**
 * Ảnh xem trước các kiểu khung, dựng lần lượt từng ảnh sau khi hiện giao diện (mỗi ảnh một lượt, không chặn khung hình) rồi nhớ lại cho các lần mở sau.
 * Kiểu nào chưa dựng xong thì chưa có trong kết quả.
 */
export const useFrameThumbnails = (styles: readonly FrameStyle[]): ReadonlyMap<FrameStyle, string> => {
  const [, rerender] = useState(0);
  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;
    const step = () => {
      const next = styles.find((style) => !cache.has(style));
      if (!next || cancelled) return;
      cache.set(next, build(next));
      rerender((count) => count + 1);
      timer = window.setTimeout(step, 0);
    };
    timer = window.setTimeout(step, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [styles]);
  return cache;
};
