import { useEffect } from 'react';
import { Outlet, ScrollRestoration, useMatches } from 'react-router';

export type RouteHandle = { title?: string };

/**
 * Khung ngoài cùng của mọi trang: link "Bỏ qua tới nội dung chính" cho người dùng bàn phím,
 * đặt tiêu đề tab theo trang, và đọc tiêu đề trang mới cho trình đọc màn hình (đổi trang không tải lại nên trình duyệt không tự đọc).
 */
export const Root = () => {
  const title = useMatches()
    .map((match) => (match.handle as RouteHandle | undefined)?.title)
    .findLast(Boolean);
  const documentTitle = title ? `${title} · Gia Phả` : 'Gia Phả';

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-3 focus:font-semibold focus:text-son focus:shadow-lg"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Bỏ qua tới nội dung chính
      </a>
      <Outlet />
      {/* Trang mới (bấm link) mở ở đầu trang; Back/Forward trả đúng chỗ đang cuộn. */}
      <ScrollRestoration />
      <div aria-live="polite" className="sr-only">
        {documentTitle}
      </div>
    </>
  );
};
