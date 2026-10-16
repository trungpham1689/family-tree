type LifespanInput = { birth_year: number | null; death_year: number | null; is_deceased: boolean };

/** Dòng năm sinh–mất ngắn gọn hiển thị dưới tên một Người. */
export const lifespanText = ({ birth_year: birth, death_year: death, is_deceased: deceased }: LifespanInput): string => {
  if (birth !== null && death !== null) return `${birth} – ${death}`;
  if (birth !== null) return deceased ? `${birth} – ?` : `Sinh ${birth}`;
  if (death !== null) return `? – ${death}`;
  return deceased ? 'Đã mất' : '';
};
