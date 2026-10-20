import { useEffect, useRef, useState } from 'react';
import { changeDesign, settleDesign, type DesignChange, type DesignContext } from './design';
import type { PhaDoConfig } from './config';

/** Gõ chữ trang trí từng phím: hiện chữ ngay, chờ ngừng gõ chừng này rồi mới co giãn lại. */
const SETTLE_DELAY_MS = 300;

/**
 * Trạng thái thiết kế Phả đồ cho giao diện: `config` luôn vừa khít (xem `design.ts`), `change` nhận sự kiện.
 * Mở trang thì đưa cấu hình đã lưu về dạng vừa khít; dữ liệu gia phả đổi (người khác sửa, tải lại) thì tự co giãn lại ngay lúc vẽ,
 * không để khổ giấy cũ lệch so với cây mới.
 */
export const usePhaDoDesign = (context: DesignContext, initial: PhaDoConfig) => {
  const [state, setState] = useState(() => ({ context, config: settleDesign(context, initial) }));
  if (state.context.graph !== context.graph || state.context.treeName !== context.treeName) {
    setState({ context, config: settleDesign(context, state.config) });
  }

  // Bộ hẹn giờ đọc trạng thái mới nhất, không đọc bản chụp lúc hẹn.
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  });
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const change = (event: DesignChange) => {
    const { config, pending } = changeDesign(state.context, state.config, event);
    setState({ context: state.context, config });
    // 'keep' (đổi màu, phông chữ) không được huỷ lần settle đang chờ: huỷ thì chữ vừa gõ sẽ không bao giờ được co giãn.
    if (pending !== 'keep') window.clearTimeout(timer.current);
    if (pending === 'schedule') {
      timer.current = window.setTimeout(() => {
        const { context: current, config: unsettled } = latest.current;
        setState({ context: current, config: settleDesign(current, unsettled) });
      }, SETTLE_DELAY_MS);
    }
  };

  return { config: state.config, change };
};
