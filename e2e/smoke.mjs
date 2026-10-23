/**
 * Test khói end-to-end: bật backend giả lập + bản build e2e của app, rồi chạy lần lượt
 * walk-1 (luồng cơ bản), walk-2 (mọi tính năng), walk-3 (PWA, thống kê, gộp trùng, lịch đăng ký), walk-5 (kéo thả đổi thứ tự con), walk-6 (nhập khổ giấy, cỡ chữ Phả đồ), walk-multi-husband (con gái nhiều đời chồng trên Cây, không ô nào chồng nhau) , walk-invite (mời email chưa có tài khoản), walk-co-parent (cha/mẹ còn lại của con), walk-event-order (sự kiện sắp tới lên trên, đã qua gập sẵn ở mọi danh sách), walk-owner-qr (trao quyền Chủ sở hữu, năm tháng có thể sai, mã QR) và walk-mobile (khổ 375px, không tràn ngang).
 * Cần: .tools/postgrest, apps/web/dist-e2e (e2e/rebuild.sh), Chromium cho Playwright.
 * Chạy: node e2e/smoke.mjs
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const children = [];

const start = (command, args, options, readyText) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    const timer = setTimeout(() => reject(new Error(`${command} không sẵn sàng sau 60 giây`)), 60_000);
    const watch = (chunk) => {
      const text = chunk.toString();
      process.stdout.write(`[${command}] ${text}`);
      if (text.includes(readyText)) {
        clearTimeout(timer);
        resolve(child);
      }
    };
    child.stdout.on('data', watch);
    child.stderr.on('data', watch);
    child.on('exit', (code) => reject(new Error(`${command} dừng sớm (mã ${code})`)));
  });

const run = (script) =>
  new Promise((resolve) => {
    console.log(`\n=== ${script} ===`);
    const child = spawn(process.execPath, [join(ROOT, 'e2e', script)], { stdio: 'inherit' });
    child.on('exit', (code) => resolve(code === 0));
  });

let ok = false;
try {
  await start(process.execPath, [join(ROOT, 'e2e/backend.mjs')], {}, 'E2E_BACKEND_READY');
  await start(
    'npx',
    ['vite', 'preview', '--outDir', 'dist-e2e', '--port', '4173', '--strictPort', '--host', '127.0.0.1'],
    { cwd: join(ROOT, 'apps/web') },
    '4173',
  );
  const results = [];
  for (const script of ['walk-1.mjs', 'walk-2.mjs', 'walk-3.mjs', 'walk-4.mjs', 'walk-5.mjs', 'walk-6.mjs', 'walk-multi-husband.mjs', 'walk-invite.mjs', 'walk-co-parent.mjs', 'walk-event-order.mjs', 'walk-owner-qr.mjs', 'walk-mobile.mjs']) results.push(await run(script));
  ok = results.every(Boolean);
} catch (error) {
  console.error(error.message);
} finally {
  for (const child of children) child.kill();
}
console.log(ok ? '\nTEST KHÓI: ĐẠT' : '\nTEST KHÓI: CÓ LỖI');
process.exit(ok ? 0 : 1);
