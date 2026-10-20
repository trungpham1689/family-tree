/** Kịch bản trình duyệt cho trang quản trị: chỉ siêu quản trị vào được; duyệt, thu hồi và cấp quyền tài khoản. */
import { APP, makeStep, openBrowser, reportProblems } from './walk-lib.mjs';

const { browser, page, problems } = await openBrowser();
const step = makeStep(() => page);
const stamp = Date.now();
const rootEmail = 'trungpham168@gmail.com';
const userEmail = `cho-duyet-walk4-${stamp}@example.com`;

const signUp = async (p, address) => {
  await p.goto(`${APP}/dang-nhap`);
  await p.getByRole('tab', { name: 'Tạo tài khoản' }).click();
  await p.getByLabel('Email').fill(address);
  await p.getByLabel('Họ và tên').fill('Người Thử');
  await p.getByLabel('Ngày sinh').fill('1990-01-01');
  await p.getByLabel('Số điện thoại').fill('0901234567');
  await p.locator('input[type=password]').first().fill('matkhau123');
  await p.getByRole('button', { name: 'Tạo tài khoản' }).last().click();
};
const newSession = async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'vi-VN' });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  return { context, page: await context.newPage() };
};

let user;
await step('tài khoản thường mới đăng ký: chờ duyệt, không có link Quản trị, /quan-tri bị chặn', async () => {
  user = await newSession();
  await signUp(user.page, userEmail);
  await user.page.getByRole('heading', { name: 'Tài khoản đang chờ duyệt' }).waitFor();
  await user.page.goto(`${APP}/quan-tri`);
  await user.page.getByRole('heading', { name: 'Tài khoản đang chờ duyệt' }).waitFor();
});

await step('siêu quản trị gốc đăng ký: vào thẳng được, thấy link Quản trị', async () => {
  await signUp(page, rootEmail);
  await page.waitForURL(/\/gia-pha$/);
  await page.getByRole('link', { name: 'Quản trị' }).waitFor();
});

await step('trang quản trị liệt kê người chờ duyệt; duyệt xong người đó vào được app', async () => {
  await page.getByRole('link', { name: 'Quản trị' }).click();
  await page.getByRole('heading', { name: 'Quản lý tài khoản' }).waitFor();
  const row = page.getByRole('listitem').filter({ hasText: userEmail });
  await row.getByText('Chờ duyệt').waitFor();
  // Hồ sơ nhập lúc đăng ký và người mời (tự đăng ký nên không có).
  await row.getByText('Người Thử', { exact: true }).waitFor();
  await row.getByText('Ngày sinh 01/01/1990 · Điện thoại 0901234567').waitFor();
  await row.getByText('Người mời: không có (tự đăng ký)').waitFor();
  await row.getByRole('button', { name: 'Duyệt', exact: true }).click();
  await page.getByRole('tab', { name: /Đã duyệt/ }).click();
  await page.getByRole('listitem').filter({ hasText: userEmail }).getByText('Đã duyệt').waitFor();
  await user.page.getByRole('button', { name: 'Kiểm tra lại' }).click();
  // Người đó đang ở /quan-tri: được duyệt xong thì qua màn chờ nhưng vẫn không phải siêu quản trị.
  await user.page.getByRole('heading', { name: 'Không có quyền truy cập' }).waitFor({ timeout: 15000 });
  await user.page.goto(`${APP}/gia-pha`);
  await user.page.getByRole('heading', { name: 'Gia phả của tôi' }).waitFor();
  if (await user.page.getByRole('link', { name: 'Quản trị' }).count()) throw new Error('tài khoản thường thấy link Quản trị');
});

await step('tài khoản thường vào /quan-tri: không có quyền truy cập', async () => {
  await user.page.goto(`${APP}/quan-tri`);
  await user.page.getByRole('heading', { name: 'Không có quyền truy cập' }).waitFor();
});

await step('thu hồi có xác nhận: người đó quay lại màn chờ duyệt', async () => {
  await page.getByRole('listitem').filter({ hasText: userEmail }).getByRole('button', { name: 'Thu hồi' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Thu hồi' }).click();
  await page.getByRole('tab', { name: /Chờ duyệt/ }).click();
  await page.getByRole('listitem').filter({ hasText: userEmail }).getByText('Chờ duyệt').waitFor();
  await user.page.goto(`${APP}/gia-pha`);
  await user.page.getByRole('heading', { name: 'Tài khoản đang chờ duyệt' }).waitFor();
});

await step('gốc cấp rồi gỡ quyền siêu quản trị; dòng của gốc không có nút thu hồi', async () => {
  await page.getByRole('tab', { name: /Tất cả/ }).click();
  const row = page.getByRole('listitem').filter({ hasText: userEmail });
  await row.getByRole('button', { name: 'Cấp siêu quản trị' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cấp quyền' }).click();
  await row.getByText('Siêu quản trị', { exact: true }).waitFor();
  await user.page.goto(`${APP}/gia-pha`);
  await user.page.getByRole('link', { name: 'Quản trị' }).waitFor();
  await row.getByRole('button', { name: 'Gỡ siêu quản trị' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Gỡ quyền' }).click();
  await row.getByText('Đã duyệt', { exact: true }).waitFor();
  const mine = page.getByRole('listitem').filter({ hasText: rootEmail });
  await mine.getByText('Siêu quản trị gốc').waitFor();
  if (await mine.getByRole('button', { name: /Thu hồi|Gỡ siêu quản trị/ }).count()) throw new Error('gốc có nút thu hồi/gỡ quyền');
});

const openMyProfile = async () => {
  await page.getByRole('button', { name: 'Tài khoản' }).click();
  await page.getByRole('menuitem', { name: 'Cá nhân' }).click();
};

await step('quản trị sửa hồ sơ người khác; mọi hộp đóng khi bấm ra ngoài; người dùng sửa hồ sơ của mình', async () => {
  const row = page.getByRole('listitem').filter({ hasText: userEmail });
  await row.getByRole('button', { name: 'Sửa hồ sơ' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Họ và tên').fill('Tên Đã Sửa');
  await dialog.getByRole('button', { name: 'Lưu' }).click();
  await dialog.waitFor({ state: 'hidden' });
  await row.getByText('Tên Đã Sửa').waitFor();

  await row.getByRole('button', { name: 'Sửa hồ sơ' }).click();
  await dialog.waitFor();
  await page.mouse.click(5, 5);
  await dialog.waitFor({ state: 'hidden' });

  await openMyProfile();
  await dialog.getByLabel('Số điện thoại').fill('0911222333');
  await dialog.getByRole('button', { name: 'Lưu' }).click();
  await dialog.waitFor({ state: 'hidden' });
  await openMyProfile();
  await page.waitForFunction(() => document.querySelector('dialog[open] input[type=tel]')?.value === '0911222333');
  await page.mouse.click(5, 5);
  await dialog.waitFor({ state: 'hidden' });
});

await step('gửi link đặt lại mật khẩu, chặn, bỏ chặn rồi xoá tài khoản (xoá phải gõ lại email)', async () => {
  const recovered = [];
  await page.route('**/auth/v1/recover*', (route) => {
    recovered.push(route.request().postData() ?? '');
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  const row = () => page.getByRole('listitem').filter({ hasText: userEmail });
  await row().getByRole('button', { name: 'Gửi link đặt lại mật khẩu' }).click();
  await page.getByRole('status').filter({ hasText: 'Đã gửi email đặt lại mật khẩu' }).waitFor();
  if (!recovered.some((body) => body.includes(userEmail))) throw new Error('không gọi /auth/v1/recover cho tài khoản đó');

  await row().getByRole('button', { name: 'Chặn', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Chặn', exact: true }).click();
  await row().getByText('Bị chặn').waitFor();
  await row().getByRole('button', { name: 'Bỏ chặn' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Bỏ chặn' }).click();
  await row().getByText('Chờ duyệt').waitFor();

  await row().getByRole('button', { name: 'Xoá', exact: true }).click();
  const confirm = page.getByRole('dialog').getByRole('button', { name: 'Xoá vĩnh viễn' });
  if (await confirm.isEnabled()) throw new Error('nút xoá bật khi chưa gõ email');
  await page.getByRole('dialog').getByLabel('Gõ lại email để xác nhận').fill(userEmail);
  await confirm.click();
  await row().waitFor({ state: 'detached' });
});

await browser.close();
reportProblems(problems);
