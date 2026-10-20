// Con gái nhiều đời chồng trên Cây: dựng bằng RPC thật như giao diện, chụp màn hình, kiểm tra các ô không chồng nhau.
import { APP, makeStep, openBrowser, reportProblems, SHOTS } from './walk-lib.mjs';

const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:54321';
const { browser, page, problems } = await openBrowser();
await page.setViewportSize({ width: 1500, height: 1080 });
const step = makeStep(() => page);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

let treeId = '';
let token = '';
const call = async (path, body, method = 'POST') => {
  const response = await fetch(`${API}/rest/v1/${path}`, {
    method,
    headers: { apikey: 'local-anon-key', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
};
const addChild = (parent, other, person) => call('rpc/add_child', { parent_id: parent, other_parent_id: other, link_kind: 'ruot', person });
const addSpouse = (personId, order, person) => call('rpc/add_spouse', { person_id: personId, union_order: order, person });

await step('đăng ký, tạo gia phả', async () => {
  await page.goto(`${APP}/`);
  await page.waitForURL(/dang-nhap/);
  await page.getByRole('tab', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(`nhieu-chong-${Date.now()}@example.com`);
  await page.getByLabel('Họ và tên').fill('Người Thử');
  await page.getByLabel('Ngày sinh').fill('1990-01-01');
  await page.getByLabel('Số điện thoại').fill('0901234567');
  await page.locator('input[type=password]').first().fill('matkhau123');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).last().click();
  await page.waitForURL(/\/gia-pha$/);
  await page.getByRole('button', { name: /Tạo gia phả/ }).first().click();
  await page.getByLabel('Tên gia phả').fill('Họ Phạm');
  await page.getByRole('dialog').getByRole('button', { name: 'Tạo gia phả' }).click();
  await page.waitForURL(/\/gia-pha\/[0-9a-f-]{36}$/);
  treeId = page.url().match(/gia-pha\/([0-9a-f-]{36})/)[1];
  token = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
    return JSON.parse(localStorage.getItem(key)).access_token;
  });
});

await step('dựng: con gái Lan ba đời chồng, mỗi chồng một con, con chưa rõ cha, hai cháu', async () => {
  const [to] = await call('persons', { tree_id: treeId, full_name: 'Phạm Văn Tổ', gender: 'nam', birth_year: 1900 });
  await addSpouse(to.id, 1, { full_name: 'Nguyễn Thị Mẹ', gender: 'nu', birth_year: 1905 });
  const lan = await addChild(to.id, null, { full_name: 'Phạm Thị Lan', gender: 'nu', birth_year: 1930, birth_order: 1 });
  await addChild(to.id, null, { full_name: 'Phạm Văn Nam', gender: 'nam', birth_year: 1935, birth_order: 2 });
  const husbands = [];
  for (const [index, name] of ['Trần Văn Một', 'Lê Văn Hai', 'Hoàng Văn Ba'].entries()) husbands.push(await addSpouse(lan, index + 1, { full_name: name, gender: 'nam' }));
  const an = await addChild(lan, husbands[0], { full_name: 'Trần Văn An', gender: 'nam', birth_year: 1955 });
  await addChild(lan, husbands[1], { full_name: 'Lê Thị Bình', gender: 'nu', birth_year: 1960 });
  const cuong = await addChild(lan, husbands[2], { full_name: 'Hoàng Văn Cường', gender: 'nam', birth_year: 1965 });
  await addChild(lan, null, { full_name: 'Phạm Thị Dung', gender: 'nu', birth_year: 1970 });
  await addChild(an, null, { full_name: 'Trần Văn Em', gender: 'nam', birth_year: 1980 });
  await addChild(cuong, null, { full_name: 'Hoàng Thị Phương', gender: 'nu', birth_year: 1990 });
});

const SHOWN = 'Phạm Văn Tổ,Nguyễn Thị Mẹ,Phạm Thị Lan,Phạm Văn Nam,Trần Văn Một,Lê Văn Hai,Hoàng Văn Ba,Trần Văn An,Lê Thị Bình,Hoàng Văn Cường,Phạm Thị Dung,Trần Văn Em,Hoàng Thị Phương';

await step('Cây hiện đủ 13 người, không ô nào chồng nhau, chụp màn hình', async () => {
  await page.goto(`${APP}/gia-pha/${treeId}/cay`);
  await page.getByRole('button', { name: /^Phạm Thị Lan/ }).waitFor({ timeout: 15000 });
  // Mặc định chỉ hiện Cháu ngoại 1 đời: chọn 3 đời để thấy cả cháu của con gái.
  await page.getByLabel('Hiển thị').selectOption({ label: 'Hiện Cháu ngoại 3 đời' });
  await page.getByRole('button', { name: /^Hoàng Thị Phương/ }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
  const boxes = await page.$$eval('svg g[role="button"][aria-label]', (nodes) =>
    nodes
      .filter((n) => !n.hasAttribute('aria-expanded'))
      .map((n) => {
        const r = n.querySelector('rect').getBoundingClientRect();
        return { name: n.getAttribute('aria-label').split(',')[0], x: r.x, y: r.y, w: r.width, h: r.height };
      }),
  );
  const names = boxes.map((b) => b.name).sort();
  assert(names.join(',') === SHOWN.split(',').sort().join(','), `thiếu/thừa: ${names.join(' | ')}`);
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert(!overlap, `${a.name} chồng ${b.name}`);
    }
  }
  await page.screenshot({ path: `${SHOTS}/cay-con-gai-ba-chong.png` });
  // Cận cảnh chỗ nối chồng - con.
  await page.screenshot({ path: `${SHOTS}/cay-con-gai-ba-chong-can-canh.png`, clip: { x: 260, y: 510, width: 820, height: 280 } });
  return `${boxes.length} ô`;
});

await step('Phả đồ vẽ cùng bố cục, chụp màn hình', async () => {
  await page.goto(`${APP}/gia-pha/${treeId}/pha-do`);
  await page.locator('section[aria-label="Xem trước bản in"] svg').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await page.locator('section[aria-label="Xem trước bản in"]').screenshot({ path: `${SHOTS}/pha-do-con-gai-ba-chong.png` });
});

await browser.close();
reportProblems(problems);
