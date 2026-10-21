import { useSyncExternalStore } from 'react';

/** Sự kiện của Chrome/Edge/Android; chưa có trong lib.dom. */
type InstallEvent = Event & { prompt: () => Promise<unknown> };

/** Cách cài: `prompt` (trình duyệt cho gọi hộp cài đặt), `ios` (Safari iOS, phải tự "Thêm vào MH chính"), `none` (đã cài hoặc không hỗ trợ). */
export type InstallMode = 'prompt' | 'ios' | 'none';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

// iPadOS 13+ tự xưng là Macintosh; phân biệt bằng màn hình cảm ứng.
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

let deferred: InstallEvent | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

// Đăng ký ngay khi nạp (import từ main.tsx): sự kiện chỉ bắn một lần, có thể trước khi menu được dựng.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferred = event as InstallEvent;
  notify();
});
window.addEventListener('appinstalled', () => {
  deferred = undefined;
  notify();
});

const getMode = (): InstallMode => {
  if (isStandalone()) return 'none';
  if (deferred) return 'prompt';
  return isIos() ? 'ios' : 'none';
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export const useInstallMode = () => useSyncExternalStore(subscribe, getMode, () => 'none');

/** Mở hộp cài đặt của trình duyệt (chỉ khi mode là `prompt`). */
export const promptInstall = async () => {
  const event = deferred;
  if (!event) return;
  deferred = undefined;
  await event.prompt();
  notify();
};
