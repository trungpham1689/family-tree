import { useEffect, useRef, type ReactNode } from 'react';

type DialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** Hộp thoại dùng thẻ <dialog> gốc của trình duyệt: có sẵn bẫy focus và phím Esc; thêm nút X và đóng khi bấm ra ngoài. */
export const Dialog = ({ open, title, onClose, children }: DialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  // Chỉ đóng khi cả lúc nhấn lẫn lúc thả chuột đều ở vùng nền: bôi đen chữ trong hộp rồi thả ra ngoài thì không đóng.
  const pressedOnBackdrop = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onMouseDown={(event) => {
        pressedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedOnBackdrop.current && event.target === event.currentTarget) onClose();
        pressedOnBackdrop.current = false;
      }}
      aria-labelledby="dialog-title"
      className="m-auto max-h-[92dvh] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 id="dialog-title" className="font-serif text-2xl font-bold">
              {title}
            </h2>
            <button
              type="button"
              aria-label="Đóng"
              onClick={onClose}
              className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-2xl leading-none text-ink-muted hover:bg-paper hover:text-ink"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
};
