// Con chưa rõ cha/mẹ còn lại: hỏi ghi khi thêm vợ/chồng đầu tiên, bắt chọn khi có từ hai vợ/chồng, gợi ý ghi ở trang cha/mẹ.
import { APP, makeStep, openBrowser, reportProblems } from './walk-lib.mjs';

const { browser, page, problems } = await openBrowser();
const step = makeStep(() => page);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const conSection = () => page.locator('section:has(h2:text-is("Con"))');
const openPerson = async (name) => {
  await page.getByRole('link', { name: new RegExp(name) }).first().click();
  await page.waitForURL(/nguoi/);
  await page.getByRole('heading', { level: 1, name }).waitFor();
};
const addViaDialog = async (button, name, submit = 'Thêm', extra) => {
  await page.getByRole('button', { name: button }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Họ và tên').fill(name);
  if (extra) await extra(dialog);
  await dialog.getByRole('button', { name: submit, exact: true }).click();
};

await step('đăng ký, tạo gia phả, thêm Cha và con khi chưa có vợ', async () => {
  await page.goto(`${APP}/`);
  await page.waitForURL(/dang-nhap/);
  await page.getByRole('tab', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(`dong-cha-me-${Date.now()}@example.com`);
  await page.getByLabel('Họ và tên').fill('Người Thử');
  await page.getByLabel('Ngày sinh').fill('1990-01-01');
  await page.getByLabel('Số điện thoại').fill('0901234567');
  await page.locator('input[type=password]').first().fill('matkhau123');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).last().click();
  await page.waitForURL(/\/gia-pha$/);
  await page.getByRole('button', { name: /Tạo gia phả/ }).first().click();
  await page.getByLabel('Tên gia phả').fill('Họ Cha Mẹ');
  await page.getByRole('dialog').getByRole('button', { name: 'Tạo gia phả' }).click();
  await page.waitForURL(/\/gia-pha\/[0-9a-f-]{36}$/);
  await page.getByRole('button', { name: 'Thêm Thuỷ tổ' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Họ và tên').fill('Cha Gốc');
  await dialog.getByRole('button', { name: 'Thêm', exact: true }).click();
  await openPerson('Cha Gốc');
  await addViaDialog('+ Thêm con', 'Con Một', 'Thêm con');
  await conSection().getByText('Con Một').waitFor();
});

await step('thêm vợ đầu tiên: hỏi ghi làm mẹ, mặc định tích sẵn; ghi xong mẹ thấy con', async () => {
  await page.getByRole('button', { name: '+ Thêm vợ/chồng' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Họ và tên').fill('Mẹ Cả');
  await dialog.getByRole('button', { name: 'Thêm', exact: true }).click();
  await dialog.getByText(/chưa ghi mẹ/).waitFor();
  assert(await dialog.getByRole('checkbox', { name: 'Con Một' }).isChecked(), 'con chưa tích sẵn khi là vợ đầu tiên');
  await dialog.getByRole('button', { name: 'Ghi 1 con' }).click();
  await dialog.waitFor({ state: 'detached' });
  await openPerson('Mẹ Cả');
  await conSection().getByText('Con Một').waitFor();
});

await step('cha có hai vợ: thêm con bắt chọn mẹ (không tự lấy vợ đầu); chọn "Không rõ" thì trang cha gợi ý ghi cho từng con', async () => {
  await page.getByRole('link', { name: /Cha Gốc/ }).first().click();
  await page.getByRole('heading', { level: 1, name: 'Cha Gốc' }).waitFor();
  await addViaDialog('+ Thêm vợ/chồng', 'Mẹ Hai');
  await page.getByRole('dialog').waitFor({ state: 'detached' });

  await page.getByRole('button', { name: '+ Thêm con' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Họ và tên').fill('Con Hai');
  assert((await dialog.locator('select').first().inputValue()) === '', 'với hai vợ phải để chưa chọn');
  await dialog.getByRole('button', { name: 'Thêm con', exact: true }).click();
  await dialog.getByText(/Hãy chọn mẹ của con/).waitFor();
  await dialog.locator('select').first().selectOption({ label: 'Không rõ / không ghi' });
  await dialog.getByRole('button', { name: 'Thêm con', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });

  const offer = conSection().getByText(/1 con chưa ghi mẹ/);
  await offer.waitFor();
  await conSection().getByLabel('Mẹ của Con Hai').selectOption({ label: 'Vợ hai: Mẹ Hai' });
  await offer.waitFor({ state: 'detached' });
});

await step('trang Mẹ Hai thấy Con Hai; trang con ghi cả cha lẫn mẹ', async () => {
  await openPerson('Mẹ Hai');
  await conSection().getByText('Con Hai').waitFor();
  assert((await conSection().getByText('Con Một').count()) === 0, 'Mẹ Hai không được thấy con của mẹ cả');
  await page.getByRole('link', { name: /Con Hai/ }).first().click();
  await page.getByRole('heading', { level: 1, name: 'Con Hai' }).waitFor();
  const parents = await page.locator('section:has(h2:text-is("Cha mẹ"))').innerText();
  assert(parents.includes('Cha Gốc') && parents.includes('Mẹ Hai'), `Cha mẹ của Con Hai: ${parents}`);
});

reportProblems(problems);
await browser.close();
