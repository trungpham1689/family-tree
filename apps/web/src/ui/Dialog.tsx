import { useEffect, useRef, type ReactNode } from 'react';

type DialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** Hộp thoại dùng thẻ <dialog> gốc của trình duyệt: có sẵn bẫy focus và phím Esc. */
export const Dialog = ({ open, title, onClose, children }: DialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);

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
      aria-labelledby="dialog-title"
      className="m-auto max-h-[92dvh] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
    >
      {open && (
        <div className="p-6">
          <h2 id="dialog-title" className="mb-4 font-serif text-2xl font-bold">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
};
