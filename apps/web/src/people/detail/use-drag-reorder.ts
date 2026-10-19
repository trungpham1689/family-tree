import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

type DragHandleProps = {
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
};

/**
 * Kéo thả để đổi thứ tự một danh sách (con, vợ/chồng…): tính lại vị trí tối đa một lần mỗi khung
 * hình thay vì mỗi sự kiện pointermove, và trượt mượt (FLIP) khi thứ tự đổi thay vì nhảy khựng.
 */
export const useDragReorder = (sourceOrder: string[], enabled: boolean, onReorder: (order: string[]) => void) => {
  const sourceKey = sourceOrder.join(',');
  // Chỉ dùng thứ tự đang kéo khi nó còn khớp dữ liệu hiện có; dữ liệu đổi (thêm/xoá, lưu xong) thì quay lại thứ tự từ server.
  const [dragState, setDragState] = useState({ key: sourceKey, order: sourceOrder });
  const order = dragState.key === sourceKey ? dragState.order : sourceOrder;
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const draggingId = useRef<string | null>(null);
  const pendingClientY = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);
  const canDrag = enabled && sourceOrder.length > 1;

  const orderKey = order.join(',');
  const prevRects = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>();
    for (const [id, element] of rowRefs.current) {
      const rect = element.getBoundingClientRect();
      const prev = prevRects.current.get(id);
      const deltaY = prev ? prev.top - rect.top : 0;
      if (deltaY) {
        element.style.transition = 'none';
        element.style.transform = `translateY(${deltaY}px)`;
        element.getBoundingClientRect(); // ép reflow để trình duyệt ghi nhận vị trí bắt đầu trước khi chuyển
        element.style.transition = 'transform 160ms ease-out';
        element.style.transform = '';
      }
      next.set(id, rect);
    }
    prevRects.current = next;
  }, [orderKey]);

  const reorderedBy = (clientY: number): string[] | null => {
    const id = draggingId.current;
    if (!id) return null;
    const rows = order.flatMap((itemId) => rowRefs.current.get(itemId) ?? []);
    let targetIndex = rows.length - 1;
    for (let index = 0; index < rows.length; index++) {
      const rect = rows[index]?.getBoundingClientRect();
      if (rect && clientY < rect.top + rect.height / 2) {
        targetIndex = index;
        break;
      }
    }
    const fromIndex = order.indexOf(id);
    if (fromIndex === -1 || fromIndex === targetIndex) return null;
    const next = order.slice();
    next.splice(fromIndex, 1);
    next.splice(targetIndex, 0, id);
    return next;
  };

  const dragHandleProps = (id: string): DragHandleProps => ({
    onPointerDown: (event) => {
      draggingId.current = id;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event) => {
      if (!draggingId.current) return;
      pendingClientY.current = event.clientY;
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        const clientY = pendingClientY.current;
        const next = clientY === null ? null : reorderedBy(clientY);
        if (next) setDragState({ key: sourceKey, order: next });
      });
    },
    onPointerUp: () => {
      if (!draggingId.current) return;
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      const clientY = pendingClientY.current;
      const finalOrder = (clientY === null ? null : reorderedBy(clientY)) ?? order;
      draggingId.current = null;
      pendingClientY.current = null;
      if (finalOrder.some((id, index) => id !== sourceOrder[index])) onReorder(finalOrder);
    },
  });

  const setRef = (id: string, element: HTMLLIElement | null) => {
    if (element) rowRefs.current.set(id, element);
    else rowRefs.current.delete(id);
  };

  return { order, canDrag, setRef, dragHandleProps };
};
