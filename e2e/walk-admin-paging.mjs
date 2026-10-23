// Trang Quản trị khi có nhiều tài khoản: chia trang 20 dòng, chuyển trang không trùng, tìm kiếm lọc ở database và về trang 1.
import { APP, makeStep, openBrowser, reportProblems } from './walk-lib.mjs';

const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:54321';
const ROOT_EMAIL = 'trungpham168@gmail.com';
const PAGE_SIZE = 20;

const { browser, page, problems } = await openBrowser();
const step = makeStep(() => page);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const stamp = Date.now();
const signUpApi = async (email) => {
  const response = await fetch(`${API}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: 'local-anon-key', 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'matkhau123', data: { full_name: 'Người Thử', birth_date: '1990-01-01', phone: '0901234567' } }),
  });
  if (!response.ok && !(await response.text()).includes('already registered')) throw new Error(`đăng ký ${email} lỗi`);
};

const list = page.locator('main ul[aria-busy]');
const rows = list.locator(':scope > li');
/** Đổi trang/tìm kiếm: danh sách cũ còn hiện (mờ) cho tới khi trang mới về. */
const settled = () => page.locator('main ul[aria-busy="false"]').waitFor();
const status = page.locator('nav[aria-label="Chia trang"] [role=status]');
const emailsOnPage = async () => (await rows.locator('p.break-all, p.text-lg').allTextContents()).join('|');
const pageInfo = async () => {
  const match = /Trang (\d+)\/(\d+) · (\d+) tài khoản/.exec((await status.textContent()) ?? '');
  if (!match) throw new Error(`không đọc được dòng chia trang: ${await status.textContent()}`);
  return { current: Number(match[1]), pages: Number(match[2]), total: Number(match[3]) };
};

await step('dựng 45 tài khoản rồi siêu quản trị gốc mở trang Quản trị, tab Tất cả', async () => {
  await signUpApi(ROOT_EMAIL);
  for (let index = 0; index < 45; index += 1) await signUpApi(`trang-${index}-${stamp}@example.com`);
  await page.goto(`${APP}/dang-nhap`);
  await page.getByLabel('Email').fill(ROOT_EMAIL);
  await page.locator('input[type=password]').first().fill('matkhau123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL(/\/gia-pha$/);
  await page.goto(`${APP}/quan-tri`);
  await page.getByRole('tab', { name: /Tất cả/ }).click();
  await status.waitFor();
  await settled();
});

await step('chia trang: 20 dòng mỗi trang, tổng khớp tab, trang sau không trùng, trang cuối khoá "Sau"', async () => {
  const info = await pageInfo();
  const tabTotal = Number(/\d+/.exec((await page.getByRole('tab', { name: /Tất cả/ }).textContent()) ?? '')?.[0]);
  assert(info.total === tabTotal && info.total >= 46, `tổng ${info.total}, tab ghi ${tabTotal}`);
  assert(info.pages === Math.ceil(info.total / PAGE_SIZE), `số trang ${info.pages} với ${info.total} tài khoản`);
  assert((await rows.count()) === PAGE_SIZE, `trang 1 có ${await rows.count()} dòng`);
  assert(await page.getByRole('button', { name: '← Trước' }).isDisabled(), 'trang 1 vẫn bấm được "Trước"');

  const seen = new Set();
  for (let current = 1; current <= info.pages; current += 1) {
    await status.filter({ hasText: `Trang ${current}/${info.pages}` }).waitFor();
    await settled();
    for (const email of (await rows.locator('p.break-all').allTextContents())) {
      assert(!seen.has(email), `${email} lặp lại ở trang ${current}`);
      seen.add(email);
    }
    const expected = current < info.pages ? PAGE_SIZE : info.total - PAGE_SIZE * (info.pages - 1);
    assert((await rows.count()) === expected, `trang ${current} có ${await rows.count()} dòng, cần ${expected}`);
    if (current < info.pages) await page.getByRole('button', { name: 'Sau →' }).click();
  }
  assert(await page.getByRole('button', { name: 'Sau →' }).isDisabled(), 'trang cuối vẫn bấm được "Sau"');
  return `${info.total} tài khoản, ${info.pages} trang`;
});

await step('tìm kiếm khi đang ở trang cuối: về trang 1, chỉ còn tài khoản khớp, bỏ tìm thì đủ lại', async () => {
  const before = await emailsOnPage();
  await page.getByLabel('Tìm theo họ tên, email hoặc số điện thoại').fill(`trang-1-${stamp}@`);
  // Thanh chia trang tính từ tổng của kết quả: biến mất nghĩa là kết quả tìm đã về (không lẫn danh sách cũ).
  await status.waitFor({ state: 'detached' });
  await settled();
  assert((await rows.count()) === 1, `tìm 1 email ra ${await rows.count()} dòng`);
  await rows.filter({ hasText: `trang-1-${stamp}@example.com` }).waitFor();

  // Khớp nhiều hơn một trang: "trang-" của lần chạy này có 45 tài khoản.
  await page.getByLabel('Tìm theo họ tên, email hoặc số điện thoại').fill(`-${stamp}@`);
  await status.filter({ hasText: 'Trang 1/3 · 45 tài khoản' }).waitFor();
  await settled();
  assert((await rows.count()) === PAGE_SIZE, `trang 1 kết quả tìm có ${await rows.count()} dòng`);

  await page.getByLabel('Tìm theo họ tên, email hoặc số điện thoại').fill('');
  await status.filter({ hasText: /^Trang 1\// }).waitFor();
  await settled();
  assert((await emailsOnPage()) !== before, 'không quay về trang 1 sau khi bỏ tìm');
});

await browser.close();
reportProblems(problems);
