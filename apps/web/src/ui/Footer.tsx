const YEAR = new Date().getFullYear();

export const Footer = () => (
  <footer className="mt-auto border-t border-line px-4 py-3 text-center text-xs text-ink-muted">
    © {YEAR} Gia Phả — Lưu giữ cội nguồn của cả dòng họ.
  </footer>
);
