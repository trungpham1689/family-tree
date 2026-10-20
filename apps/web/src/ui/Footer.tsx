import { useEffect, useState } from 'react';

/** Năm hiện tại; tính lại định kỳ để đúng cả khi tab mở qua giao thừa, không hardcode một con số. */
export const Footer = () => {
  const [year, setYear] = useState(() => new Date().getFullYear());
  useEffect(() => {
    const id = setInterval(() => setYear(new Date().getFullYear()), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <footer className="mt-auto border-t border-line px-4 py-3 text-center text-sm text-ink-muted">
      © {year} Gia Phả — Lưu giữ cội nguồn của cả dòng họ.
    </footer>
  );
};
