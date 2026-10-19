/* Service worker của Gia Phả: giữ khung ứng dụng để mở được khi mất mạng.
 * Dữ liệu gia phả không nằm ở đây (nằm ở bộ nhớ đệm IndexedDB của React Query, xoá khi đăng xuất).
 * Đổi VERSION khi sửa file này để dọn bộ nhớ cũ. */
const VERSION = 'v1';
const SHELL = `gia-pha-shell-${VERSION}`;
const ASSETS = `gia-pha-assets-${VERSION}`;
// Mỗi deploy sinh các tệp /assets băm tên mới; giữ tối đa chừng này tệp (cũ nhất bỏ trước) để bộ nhớ không phình mãi.
const MAX_ASSET_ENTRIES = 120;
// Làm tươi bản dự phòng index.html tối đa mỗi giờ một lần, không phải mỗi lần chuyển trang.
const SHELL_REFRESH_MS = 60 * 60 * 1000;
let lastShellRefresh = 0;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.add('/index.html')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => ![SHELL, ASSETS].includes(name)).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

const trim = async (cache) => {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSET_ENTRIES)).map((key) => cache.delete(key)));
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Chỉ xử lý GET cùng nguồn; API (/api), link công khai (/p, có thẻ Open Graph riêng) và Supabase đi thẳng ra mạng.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    if (url.pathname.startsWith('/p/')) return;
    // Có mạng: lấy trang mới và làm tươi bản dự phòng; mất mạng: dùng khung ứng dụng đã lưu.
    event.respondWith(
      fetch(request).then(
        (response) => {
          if (Date.now() - lastShellRefresh > SHELL_REFRESH_MS) {
            lastShellRefresh = Date.now();
            event.waitUntil(caches.open(SHELL).then((cache) => cache.add('/index.html')).catch(() => undefined));
          }
          return response;
        },
        () => caches.match('/index.html').then((cached) => cached ?? Response.error()),
      ),
    );
    return;
  }

  // Tệp tĩnh (đã băm tên trong /assets, phông, logo, biểu tượng): lấy từ bộ nhớ trước, cập nhật nền.
  if (/^\/(assets|fonts)\//.test(url.pathname) || /\.(svg|png|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              cache.put(request, response.clone()).then(() => trim(cache));
            }
            return response;
          })
          .catch(() => cached ?? Response.error());
        return cached ?? network;
      }),
    );
  }
});
