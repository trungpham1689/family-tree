import type { KeyboardEvent } from 'react';

/**
 * Bàn phím cho một nhóm tab (WAI-ARIA tabs): mũi tên trái/phải chuyển tab (vòng tròn), Home/End về đầu/cuối.
 * Tab đang chọn là điểm dừng duy nhất của phím Tab (đặt `tabIndex={on ? 0 : -1}` cho từng tab).
 */
export const onTabKeyDown = <T extends string>(
  event: KeyboardEvent<HTMLElement>,
  ids: readonly T[],
  current: T,
  select: (id: T) => void,
  domId: (id: T) => string,
): void => {
  const last = ids.length - 1;
  const index = ids.indexOf(current);
  const target =
    event.key === 'ArrowRight' ? (index + 1) % ids.length : event.key === 'ArrowLeft' ? (index - 1 + ids.length) % ids.length : event.key === 'Home' ? 0 : event.key === 'End' ? last : null;
  if (target === null || index === -1) return;
  event.preventDefault();
  const id = ids[target]!;
  select(id);
  document.getElementById(domId(id))?.focus();
};
