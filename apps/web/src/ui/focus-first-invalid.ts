/** Sau khi gửi form lỗi: đưa con trỏ về ô báo lỗi đầu tiên (đợi React vẽ xong các `aria-invalid`). */
export const focusFirstInvalid = (form: HTMLFormElement) =>
  requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
