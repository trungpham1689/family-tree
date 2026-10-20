// Kéo thả đổi Thứ tự con: bám sát con trỏ, không nhảy qua lại ở ranh giới, thả mới lưu, Esc huỷ, nút "Tự xếp theo ngày sinh".
import { APP, makeStep, openBrowser, reportProblems, SHOTS } from './walk-lib.mjs';

const { browser, page, problems } = await openBrowser();
await page.setViewportSize({ width: 1366, height: 1500 }); // cả danh sách con nằm trong khung nhìn để chuột thật kéo được
const step = makeStep(() => page);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const HANDLE = 'button[aria-label="Kéo để đổi thứ tự con"]';
/** Con sinh năm: thêm theo thứ tự lộn xộn để cần sắp xếp. */
const BIRTHS = { 'Con A': [10, 5, 2000], 'Con B': [1, 12, 1998], 'Con C': [15, 1, 2003], 'Con D': [7, 7, 1995], 'Con E': [20, 3, 2000] };
const SORTED = 'Con D,Con B,Con E,Con A,Con C';

const names = () => page.$$eval('ul li:has(button[aria-label="Kéo để đổi thứ tự con"]) a span.text-lg', (nodes) => nodes.map((node) => node.textContent.trim()));
const rpcCalls = [];
page.on('request', (request) => {
  if (request.url().includes('/rpc/reorder_children')) rpcCalls.push(request.postData());
});

/** Hai khung hình để React và rAF của hook chạy xong. */
const settle = async () => {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};
const rowAt = (index) => page.locator(`ul li:has(${HANDLE})`).nth(index);

/** Kéo `name` tới dòng đang ở vị trí `toIndex` (tính từ 0), lấy mẫu mỗi bước: thứ tự DOM đổi mấy lần, lệch giữa tâm dòng và con trỏ lớn nhất. */
const dragTo = async (name, toIndex, { steps }) => {
  await page.waitForTimeout(400); // chờ các dòng trượt xong (lần thêm/thả trước) rồi mới đo
  const fromIndex = (await names()).indexOf(name);
  const target = await rowAt(toIndex).boundingBox();
  const handle = await rowAt(fromIndex).locator(HANDLE).boundingBox();
  const startX = handle.x + handle.width / 2;
  const startY = handle.y + handle.height / 2;
  // Qua tâm dòng đích một chút theo hướng kéo thì mới đổi chỗ.
  const endY = target.y + target.height / 2 + (toIndex > fromIndex ? 1 : -1) * target.height * 0.3;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  let changes = 0;
  let last = (await names()).join('|');
  let maxGap = 0;
  for (let i = 1; i <= steps; i++) {
    const y = startY + ((endY - startY) * i) / steps;
    await page.mouse.move(startX, y);
    await settle();
    const now = (await names()).join('|');
    if (now !== last) changes++;
    last = now;
    const dragged = await rowAt((await names()).indexOf(name)).boundingBox();
    maxGap = Math.max(maxGap, Math.abs(dragged.y + dragged.height / 2 - y));
  }
  return { changes, maxGap };
};

await step('đăng ký, tạo gia phả, thêm Thuỷ tổ và 5 con', async () => {
  await page.goto(`${APP}/`);
  await page.waitForURL(/dang-nhap/);
  await page.getByRole('tab', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(`keo-tha-${Date.now()}@example.com`);
  await page.getByLabel('Họ và tên').fill('Người Thử');
  await page.getByLabel('Ngày sinh').fill('1990-01-01');
  await page.getByLabel('Số điện thoại').fill('0901234567');
  await page.locator('input[type=password]').first().fill('matkhau123');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).last().click();
  await page.waitForURL(/\/gia-pha$/);
  await page.getByRole('button', { name: /Tạo gia phả/ }).first().click();
  await page.getByLabel('Tên gia phả').fill('Họ Kéo Thả');
  await page.getByRole('dialog').getByRole('button', { name: 'Tạo gia phả' }).click();
  await page.waitForURL(/\/gia-pha\/[0-9a-f-]{36}$/);
  await page.getByRole('button', { name: 'Thêm Thuỷ tổ' }).click();
  await page.getByRole('dialog').getByLabel('Họ và tên').fill('Cha Tổ');
  await page.getByRole('dialog').getByRole('button', { name: 'Thêm', exact: true }).click();
  await page.getByRole('link', { name: /Cha Tổ/ }).first().click();
  await page.waitForURL(/nguoi/);
  for (const [name, [day, month, year]] of Object.entries(BIRTHS)) {
    await page.getByRole('button', { name: '+ Thêm con' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Họ và tên').fill(name);
    await dialog.getByLabel('Ngày', { exact: true }).fill(String(day));
    await dialog.getByLabel('Tháng', { exact: true }).fill(String(month));
    await dialog.getByLabel('Năm', { exact: true }).fill(String(year));
    await dialog.getByRole('button', { name: 'Thêm con', exact: true }).click();
    await page.getByText(name, { exact: true }).first().waitFor();
  }
});

await step('mặc định con xếp theo ngày tháng năm sinh', async () => {
  const order = await names();
  assert(order.join() === SORTED, `thứ tự ${order.join()}`);
});

await step('nút "Tự xếp theo ngày sinh" ẩn khi đã đúng thứ tự', async () => {
  assert((await page.getByRole('button', { name: /Tự xếp theo ngày sinh/ }).count()) === 0, 'nút vẫn hiện');
});

await step('kéo chậm con đầu xuống cuối: bám sát con trỏ, mỗi ranh giới đổi đúng một lần', async () => {
  rpcCalls.length = 0;
  const { changes, maxGap } = await dragTo('Con D', 4, { steps: 60 });
  assert(changes === 4, `thứ tự đổi ${changes} lần, đúng ra 4`);
  assert(maxGap <= 3, `dòng đang kéo lệch con trỏ tới ${maxGap.toFixed(1)}px`);
  assert(rpcCalls.length === 0, 'đã lưu trước khi thả');
  await page.screenshot({ path: `${SHOTS}/walk5-dragging.png` });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const order = await names();
  assert(order.join() === 'Con B,Con E,Con A,Con C,Con D', `sau thả: ${order.join()}`);
  assert(rpcCalls.length === 1, `gọi reorder_children ${rpcCalls.length} lần, đúng ra 1`);
  return `lệch tối đa ${maxGap.toFixed(1)}px`;
});

await step('thả xong: dòng về đúng chỗ, không còn kiểu "đang kéo" hay dịch chuyển dở', async () => {
  await page.waitForTimeout(400);
  const leftover = await page.$$eval(`ul li:has(${HANDLE})`, (rows) =>
    rows.filter((row) => row.style.transform || row.classList.contains('shadow-lg') || row.classList.contains('z-10')).length,
  );
  assert(leftover === 0, `${leftover} dòng còn kiểu kéo`);
});

await step('tải lại trang: thứ tự đã lưu', async () => {
  await page.waitForTimeout(2500); // bộ nhớ offline ghi trễ ~1 giây
  await page.reload();
  await page.getByText('Con A', { exact: true }).first().waitFor();
  const order = await names();
  assert(order.join() === 'Con B,Con E,Con A,Con C,Con D', `sau tải lại: ${order.join()}`);
});

await step('kéo nhanh (ít bước) con cuối lên đầu', async () => {
  rpcCalls.length = 0;
  const { maxGap } = await dragTo('Con D', 0, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const order = await names();
  assert(order.join() === SORTED, `sau thả: ${order.join()}`);
  assert(rpcCalls.length === 1, `gọi reorder_children ${rpcCalls.length} lần`);
  return `lệch tối đa ${maxGap.toFixed(1)}px`;
});

await step('di chuột qua lại sát ranh giới: không nhảy qua lại', async () => {
  const handle = page.locator('li', { has: page.getByText('Con B', { exact: true }) }).locator(HANDLE).first();
  const hb = await handle.boundingBox();
  const x = hb.x + hb.width / 2;
  const y0 = hb.y + hb.height / 2;
  const neighbor = await rowAt(2).boundingBox();
  const boundary = (y0 + neighbor.y + neighbor.height / 2) / 2 + 6; // sát ranh giới giữa hai dòng, hơi lấn sang dòng dưới
  await page.mouse.move(x, y0);
  await page.mouse.down();
  await page.mouse.move(x, boundary, { steps: 10 });
  await settle();
  let changes = 0;
  let last = (await names()).join('|');
  for (let i = 0; i < 40; i++) {
    await page.mouse.move(x, boundary + (i % 2 === 0 ? -4 : 4));
    await settle();
    const now = (await names()).join('|');
    if (now !== last) changes++;
    last = now;
  }
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.waitForTimeout(400);
  assert(changes <= 1, `thứ tự nhảy ${changes} lần khi rung quanh ranh giới`);
  return `${changes} lần đổi trong 40 lần rung`;
});

await step('Esc huỷ: thứ tự trở lại như cũ, không lưu', async () => {
  const order = await names();
  assert(order.join() === SORTED, `sau Esc: ${order.join()}`);
  rpcCalls.length = 0;
  const handle = page.locator('li', { has: page.getByText('Con D', { exact: true }) }).locator(HANDLE).first();
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 200, { steps: 20 });
  await settle();
  assert((await names())[0] !== 'Con D', 'chưa đổi chỗ khi kéo');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.waitForTimeout(400);
  assert((await names()).join() === SORTED, 'Esc không hoàn lại thứ tự');
  assert(rpcCalls.length === 0, 'Esc vẫn lưu');
});

await step('bấm rồi thả không kéo: không gọi lưu', async () => {
  rpcCalls.length = 0;
  const handle = page.locator(HANDLE).nth(1);
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 5);
  await page.mouse.up();
  await page.waitForTimeout(300);
  assert(rpcCalls.length === 0, 'đã gọi lưu dù không đổi chỗ');
});

await step('kéo hai lần liên tiếp không kẹt (không "dính")', async () => {
  const first = await dragTo('Con D', 3, { steps: 12 });
  assert((await names()).join() === 'Con B,Con E,Con A,Con D,Con C', `sau kéo 1: ${(await names()).join()}`);
  await page.mouse.up();
  await page.waitForTimeout(400);
  const second = await dragTo('Con C', 3, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const order = await names();
  assert(new Set(order).size === 5, `mất hoặc nhân đôi dòng: ${order.join()}`);
  assert(first.changes >= 1 && second.changes >= 1, 'một trong hai lần kéo không đổi chỗ');
  // Sau khi thả, di chuột tự do không được kéo thêm gì.
  const before = order.join();
  await page.mouse.move(300, 200);
  await page.mouse.move(300, 700, { steps: 10 });
  await settle();
  assert((await names()).join() === before, 'thứ tự đổi sau khi đã thả chuột');
});

await step('"Tự xếp theo ngày sinh" xếp lại theo năm và lưu', async () => {
  const button = page.getByRole('button', { name: /Tự xếp theo ngày sinh/ });
  await button.waitFor();
  rpcCalls.length = 0;
  await button.click();
  await page.waitForFunction(() => !document.body.innerText.includes('Tự xếp theo ngày sinh'));
  assert((await names()).join() === SORTED, `sau tự xếp: ${(await names()).join()}`);
  assert(rpcCalls.length === 1, `gọi lưu ${rpcCalls.length} lần`);
  await page.waitForTimeout(2500); // bộ nhớ offline ghi trễ ~1 giây
  await page.reload();
  await page.getByText('Con A', { exact: true }).first().waitFor();
  assert((await names()).join() === SORTED, 'tải lại mất thứ tự');
});

reportProblems(problems);
await browser.close();
