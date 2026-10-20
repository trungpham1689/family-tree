import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

type DragHandleProps = {
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
};

type Drag = { id: string; startClientY: number; startScrollY: number; startTop: number; pointerY: number };

/** Lớp áp lên dòng đang kéo: nổi lên trên các dòng khác, không bôi đen chữ. */
const DRAGGING_CLASSES = ['relative', 'z-10', 'bg-surface', 'shadow-lg', 'select-none'];
const SETTLE_MS = 160;
const SETTLE = `transform ${SETTLE_MS}ms ease-out`;

/** Dịch chuyển dọc hiện tại của một phần tử (kể cả khi đang trượt dở). */
const currentShift = (element: HTMLElement): number => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42;

/**
 * Kéo thả để đổi thứ tự một danh sách (con, vợ/chồng…).
 * - Dòng đang kéo bám sát con trỏ; các dòng còn lại trượt (FLIP) vào chỗ mới.
 * - Vị trí đo bằng `offsetTop` (bỏ qua transform), nên dòng đang trượt dở không làm thứ tự nhảy qua lại.
 * - Lắng nghe ở `window` thay vì giữ con trỏ trên nút kéo: React chuyển dòng sang chỗ mới trong DOM,
 *   mà chuyển phần tử đang giữ con trỏ thì trình duyệt thả con trỏ ra và cú kéo bị đứng giữa chừng.
 */
export const useDragReorder = (sourceOrder: string[], enabled: boolean, onReorder: (order: string[]) => void) => {
  const sourceKey = sourceOrder.join(',');
  // Chỉ dùng thứ tự đang kéo khi nó còn khớp dữ liệu hiện có; dữ liệu đổi (thêm/xoá, lưu xong) thì quay lại thứ tự từ server.
  const [dragState, setDragState] = useState({ key: sourceKey, order: sourceOrder });
  const order = dragState.key === sourceKey ? dragState.order : sourceOrder;
  const canDrag = enabled && sourceOrder.length > 1;

  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const drag = useRef<Drag | null>(null);
  const latest = useRef({ order, sourceOrder, sourceKey, onReorder });
  useLayoutEffect(() => {
    latest.current = { order, sourceOrder, sourceKey, onReorder };
  });
  const stop = useRef<(() => void) | null>(null);

  /** Đặt dòng đang kéo ngay dưới con trỏ, bất kể nó đang nằm ở chỗ nào trong DOM. */
  const placeDragged = () => {
    const current = drag.current;
    const element = current && rowRefs.current.get(current.id);
    if (!current || !element) return;
    const shift = current.pointerY - current.startClientY + (window.scrollY - current.startScrollY) - (element.offsetTop - current.startTop);
    element.style.transform = `translateY(${shift}px)`;
  };

  /** Dòng đang kéo nằm ở vị trí nào trong danh sách: đếm các dòng khác có tâm nằm trên tâm dòng đang kéo. */
  const targetIndex = (current: Drag): number => {
    const element = rowRefs.current.get(current.id);
    if (!element) return -1;
    const center = element.offsetTop + element.offsetHeight / 2 + currentShift(element);
    let index = 0;
    for (const id of latest.current.order) {
      const row = rowRefs.current.get(id);
      if (id !== current.id && row && row.offsetTop + row.offsetHeight / 2 < center) index++;
    }
    return index;
  };

  const flipTops = useRef(new Map<string, number>());
  const orderKey = order.join(',');
  useLayoutEffect(() => {
    const tops = new Map<string, number>();
    for (const [id, element] of rowRefs.current) {
      const top = element.offsetTop;
      const before = flipTops.current.get(id);
      tops.set(id, top);
      if (id === drag.current?.id || before === undefined || before === top) continue;
      // Bắt đầu từ chỗ mắt đang thấy (có thể đang trượt dở), không phải từ chỗ cũ trong layout.
      element.style.transition = 'none';
      element.style.transform = `translateY(${currentShift(element) + before - top}px)`;
      element.getBoundingClientRect(); // ép reflow để trình duyệt ghi nhận vị trí bắt đầu trước khi chuyển
      element.style.transition = SETTLE;
      element.style.transform = '';
    }
    flipTops.current = tops;
    placeDragged();
  }, [orderKey]);

  const begin = (id: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    const element = rowRefs.current.get(id);
    if (!element || drag.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    const started: Drag = { id, startClientY: event.clientY, startScrollY: window.scrollY, startTop: element.offsetTop, pointerY: event.clientY };
    drag.current = started;
    element.style.transition = 'none';
    element.classList.add(...DRAGGING_CLASSES);

    let frame: number | null = null;
    const onFrame = () => {
      frame = null;
      placeDragged();
      const index = targetIndex(started);
      const { order: shown, sourceKey: key } = latest.current;
      const from = shown.indexOf(id);
      if (index === -1 || from === -1 || index === from) return;
      const next = shown.slice();
      next.splice(from, 1);
      next.splice(index, 0, id);
      setDragState({ key, order: next });
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(onFrame);
    };
    const onMove = (move: PointerEvent) => {
      started.pointerY = move.clientY;
      schedule();
    };

    const finish = (commit: boolean) => {
      stop.current?.();
      stop.current = null;
      if (frame !== null) cancelAnimationFrame(frame);
      const { order: shown, sourceOrder: original, sourceKey: key, onReorder: save } = latest.current;
      drag.current = null;
      // Thả: dòng trượt nhẹ vào đúng chỗ rồi mới bỏ kiểu "đang kéo".
      element.style.transition = SETTLE;
      element.style.transform = '';
      window.setTimeout(() => {
        element.classList.remove(...DRAGGING_CLASSES);
        element.style.transition = '';
      }, SETTLE_MS);
      if (!commit) {
        setDragState({ key, order: original });
      } else if (shown.some((value, index) => value !== original[index])) {
        save(shown);
      }
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (key: KeyboardEvent) => {
      if (key.key === 'Escape') finish(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    stop.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
    };
  };

  // Rời trang giữa lúc đang kéo thì gỡ các listener ở window.
  useLayoutEffect(() => () => stop.current?.(), []);

  const dragHandleProps = (id: string): DragHandleProps => ({
    onPointerDown: (event) => begin(id, event),
  });

  const setRef = (id: string, element: HTMLLIElement | null) => {
    if (element) rowRefs.current.set(id, element);
    else rowRefs.current.delete(id);
  };

  return { order, canDrag, setRef, dragHandleProps };
};
