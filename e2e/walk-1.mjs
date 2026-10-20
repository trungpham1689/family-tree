// Luồng cơ bản: đăng ký → tạo gia phả → thêm Thuỷ tổ, vợ, con → xem cây.
import { APP, makeStep, openBrowser, reportProblems, SHOTS } from './walk-lib.mjs';

const { browser, page, problems } = await openBrowser();
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const step = makeStep(() => page);

const email = `truong-ho-${Date.now()}@example.com`;
await step('mở app → chuyển tới đăng nhập', async () => {
  await page.goto(`${APP}/`);
  await page.waitForURL(/dang-nhap/);
  await shot('01-login');
});
await step('đăng ký tài khoản', async () => {
  await page.getByRole('tab', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Họ và tên').fill('Người Thử');
  await page.getByLabel('Ngày sinh').fill('1990-01-01');
  await page.getByLabel('Số điện thoại').fill('0901234567');
  await page.locator('input[type=password]').first().fill('matkhau123');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).last().click();
  await page.waitForURL(/\/gia-pha$/);
  await shot('02-my-trees-empty');
});
await step('tạo gia phả', async () => {
  await page.getByRole('button', { name: /Tạo gia phả/ }).first().click();
  await page.getByLabel('Tên gia phả').fill('Họ Phạm làng Đông');
  await page.getByRole('dialog').getByRole('button', { name: 'Tạo gia phả' }).click();
  await page.waitForURL(/\/gia-pha\/[0-9a-f-]{36}$/);
  await shot('03-tree-empty');
});
await step('thêm Thuỷ tổ', async () => {
  await page.getByRole('button', { name: 'Thêm Thuỷ tổ' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Họ và tên').fill('Phạm Văn Tổ');
  await shot('04-add-root-form');
  await dialog.getByRole('button', { name: 'Thêm', exact: true }).click();
  await page.getByText('Phạm Văn Tổ').first().waitFor();
  await shot('05-tree-with-root');
});
await step('mở hồ sơ Thuỷ tổ, thêm vợ', async () => {
  await page.getByRole('link', { name: /Phạm Văn Tổ/ }).first().click();
  await page.waitForURL(/nguoi/);
  await shot('06-person');
  await page.getByRole('button', { name: '+ Thêm vợ/chồng' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Họ và tên').fill('Nguyễn Thị Hiền');
  await dialog.getByRole('button', { name: 'Thêm', exact: true }).click();
  await page.getByText('Nguyễn Thị Hiền').first().waitFor();
});
await step('thêm con', async () => {
  await page.getByRole('button', { name: '+ Thêm con' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Họ và tên').fill('Phạm Văn Trưởng');
  await shot('07-add-child-form');
  await dialog.getByRole('button', { name: 'Thêm con', exact: true }).click();
  await page.getByText('Phạm Văn Trưởng').first().waitFor();
  await shot('08-person-with-family');
});
await step('xem cây', async () => {
  await page.getByRole('link', { name: /←/ }).first().click();
  await page.getByRole('link', { name: 'Cây gia phả', exact: true }).click();
  await page.waitForURL(/\/cay$/);
  await page.waitForTimeout(800);
  await shot('09-tree-view');
});
reportProblems(problems);
console.log('EMAIL', email);
await browser.close();
