// Mọi tính năng còn lại: Excel, tìm kiếm, hồ sơ, sự kiện, lịch, link công khai, Phả đồ, xoá.
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { APP, makeStep, openBrowser, reportProblems, SHOTS } from './walk-lib.mjs';

const { browser, page, problems } = await openBrowser();
let current = page;
const shot = (name, target = current) => target.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const step = makeStep(() => current);

/** PNG đơn sắc `size`×`size` (đủ lớn để qua kiểm cạnh dài tối thiểu của ảnh sự kiện). */
const solidPng = (size) => {
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, 0x9a)]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
};

/** Khổ trang đầu tiên của file PDF, đơn vị pt. */
const pdfPageSize = (path) => {
  const match = readFileSync(path, 'latin1').match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/);
  if (!match) throw new Error('không đọc được khổ trang PDF');
  return [Number(match[1]), Number(match[2])];
};
const PNG_SIGNATURE = '89504e470d0a1a0a';

const email = `excel-${Date.now()}@example.com`;
let treeUrl = '';
let publicUrl = '';
const PUBLIC_PASSWORD = 'matkhau-chung';

await step('đăng ký', async () => {
  await page.goto(`${APP}/dang-nhap`);
  await page.getByRole('tab', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Họ và tên').fill('Người Thử');
  await page.getByLabel('Ngày sinh').fill('1990-01-01');
  await page.getByLabel('Số điện thoại').fill('0901234567');
  await page.locator('input[type=password]').first().fill('matkhau123');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).last().click();
  await page.waitForURL(/\/gia-pha$/);
});

await step('tải file mẫu Excel', async () => {
  await page.getByRole('link', { name: 'Nhập từ Excel' }).click();
  await page.waitForURL(/nhap-excel/);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Tải file mẫu' }).click()]);
  await download.saveAs(`${SHOTS}/mau.xlsx`);
  return `${download.suggestedFilename()} (${statSync(`${SHOTS}/mau.xlsx`).size} byte)`;
});

await step('tải lên file mẫu → xem trước → lưu', async () => {
  await page.locator('input[type=file]').setInputFiles(`${SHOTS}/mau.xlsx`);
  await page.getByText('Không có lỗi').waitFor({ timeout: 15000 });
  await shot('20-import-preview');
  await page.getByLabel('Tên gia phả mới').fill('Họ Phạm (nhập Excel)');
  await page.getByRole('button', { name: 'Xác nhận & lưu' }).click();
  await page.waitForURL(/\/gia-pha\/[0-9a-f-]{36}$/, { timeout: 20000 });
  treeUrl = page.url();
  await page.getByRole('heading', { name: 'Họ Phạm (nhập Excel)' }).waitFor();
  await page.getByText('Phạm Văn Tổ').locator('visible=true').first().waitFor();
  await shot('21-tree-after-import');
});

await step('tìm "pham van binh" trên Cây', async () => {
  await page.goto(`${treeUrl}/cay`);
  await page.getByLabel('Tìm người').fill('pham van binh');
  await page.getByRole('option').first().click();
  await page.waitForTimeout(700);
  await shot('22-tree-search');
});

await step('đổi hướng trái → phải, chỉ đinh', async () => {
  await page.getByRole('button', { name: 'Xếp trái → phải' }).click();
  await page.getByLabel('Hiển thị').selectOption('0');
  await page.getByRole('button', { name: 'Vừa màn hình' }).click();
  await page.waitForTimeout(700);
  await shot('23-tree-left-right-dinh');
  const ngoai = await page.getByRole('button', { name: /Lê Văn Ngoại/ }).count();
  if (ngoai !== 0) throw new Error('chỉ đinh nhưng vẫn thấy cháu ngoại');
  await page.getByRole('button', { name: 'Xếp trên → dưới' }).click();
});

await step('hồ sơ Thuỷ tổ: ngày mất âm, ngày giỗ', async () => {
  await page.goto(treeUrl);
  await page.getByRole('link', { name: /Phạm Văn Tổ/ }).first().click();
  await page.getByText('Ngày giỗ').waitFor();
  await shot('24-person-root');
  return (await page.locator('dl').last().innerText()).replace(/\s+/g, ' ').slice(0, 200);
});

await step('sửa hồ sơ (nghề nghiệp) và lưu', async () => {
  await page.getByRole('button', { name: 'Sửa thông tin' }).click();
  const dialog = page.getByRole('dialog');
  const more = dialog.getByRole('button', { name: /Thêm thông tin/ });
  if (await more.count()) await more.click();
  await dialog.getByLabel('Nghề nghiệp').fill('Lý trưởng');
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await page.getByText('Lý trưởng').waitFor();
});

await step('cảnh báo khi thêm Người trùng tên', async () => {
  await page.goto(treeUrl);
  await page.getByRole('link', { name: /Phạm Văn Tổ/ }).first().click();
  await page.getByRole('button', { name: '+ Thêm con' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Họ và tên').fill('Phạm Văn Bình');
  await dialog.getByText('Gia phả đã có').waitFor();
  await dialog.getByRole('button', { name: 'Huỷ' }).click();
});

await step('Phả ký: văn bản tường thuật và xuất PDF', async () => {
  await page.goto(`${treeUrl}/pha-ky`);
  await page.getByText('Phạm Văn Tổ').first().waitFor();
  await page.getByText('Thuỷ tổ của dòng họ').first().waitFor();
  await shot('24b-pha-ky');
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất PDF' }).click()]);
  await pdf.saveAs(`${SHOTS}/pha-ky.pdf`);
  if (statSync(`${SHOTS}/pha-ky.pdf`).size < 500) throw new Error('file PDF Phả ký quá nhỏ, có thể hỏng');
});

await step('Tra cứu quan hệ: chọn hai người, thấy xưng hô', async () => {
  await page.goto(`${treeUrl}/quan-he`);
  await page.getByLabel('Người thứ nhất').fill('pham van to');
  await page.getByRole('button', { name: /Phạm Văn Tổ/ }).click();
  await page.getByLabel('Người thứ hai').fill('pham van binh');
  await page.getByRole('button', { name: /Phạm Văn Bình/ }).click();
  await page.getByText('gọi', { exact: false }).first().waitFor();
  await shot('24c-quan-he');
});

await step('Hồ sơ chưa đầy đủ: liệt kê người thiếu thông tin', async () => {
  await page.goto(`${treeUrl}/thieu-thong-tin`);
  await page.getByRole('heading', { name: 'Hồ sơ chưa đầy đủ' }).waitFor();
  await shot('24d-thieu-thong-tin');
});

await step('thêm Sự kiện âm lịch hằng năm', async () => {
  await page.goto(`${treeUrl}/su-kien`);
  await page.getByRole('button', { name: '+ Thêm sự kiện' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tên sự kiện').fill('Họp họ đầu xuân');
  await dialog.getByLabel(/^Ngày\s*\*/).fill('10');
  await dialog.getByLabel(/^Tháng\s*\*/).fill('1');
  await dialog.getByLabel(/^Từ năm\s*\*/).fill('2024');
  await dialog.getByLabel('Giờ').fill('08:30');
  await dialog.getByLabel('Địa điểm').fill('Nhà thờ họ');
  await dialog.getByRole('button', { name: 'Lưu' }).click();
  await page.getByText('Họp họ đầu xuân').waitFor();
  await shot('25-events');
});

await step('Sự kiện một lần có mô tả, chủ trì, ảnh: hiện ở trang Sự kiện, Dòng thời gian và Phả ký; ảnh quá 5MB bị từ chối', async () => {
  // Giả kho ảnh Drive (/api/photos): lưu thân yêu cầu trong bộ nhớ, trả lại khi đọc.
  const files = new Map();
  await page.route('**/api/photos**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const fileId = `fakefile${files.size}abcdef`;
      files.set(fileId, request.postDataBuffer());
      return route.fulfill({ status: 201, json: { fileId } });
    }
    if (request.method() === 'GET') {
      const body = files.get(new URL(request.url()).pathname.split('/').pop());
      return body ? route.fulfill({ status: 200, contentType: 'image/jpeg', body }) : route.fulfill({ status: 404, json: { error: 'không có' } });
    }
    return route.fulfill({ status: 204 });
  });

  await page.goto(`${treeUrl}/su-kien`);
  await page.getByRole('button', { name: '+ Thêm sự kiện' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tên sự kiện').fill('Khánh thành nhà thờ họ');
  await dialog.getByText('Dương lịch', { exact: true }).click();
  await dialog.getByText('Một lần', { exact: true }).click();
  await dialog.getByLabel(/^Ngày\s*\*/).fill('20');
  await dialog.getByLabel(/^Tháng\s*\*/).fill('12');
  await dialog.getByLabel(/^Năm\s*\*/).fill('2026');
  await dialog.getByLabel('Mô tả sự kiện').fill('Cả họ về dự lễ khánh thành.');
  await dialog.getByLabel('Tìm người chủ trì (tuỳ chọn)').fill('Tổ');
  await dialog.getByRole('button', { name: /Phạm Văn Tổ/ }).first().click();
  await dialog.getByLabel('Đưa vào Dòng thời gian').check();

  const input = dialog.locator('input[type=file]');
  await input.setInputFiles({ name: 'qua-lon.png', mimeType: 'image/png', buffer: Buffer.concat([solidPng(500), Buffer.alloc(5 * 1024 * 1024)]) });
  await dialog.getByText(/qua-lon\.png: Ảnh tối đa 5MB/).waitFor();
  await input.setInputFiles([
    { name: 'a.png', mimeType: 'image/png', buffer: solidPng(500) },
    { name: 'b.png', mimeType: 'image/png', buffer: solidPng(520) },
  ]);
  await dialog.getByText('Ảnh (2/5)').waitFor();
  await dialog.getByRole('button', { name: 'Lưu' }).click();

  const row = page.getByRole('listitem').filter({ hasText: 'Khánh thành nhà thờ họ' });
  await row.getByText('Chủ trì: Phạm Văn Tổ').waitFor();
  await row.getByText('Cả họ về dự lễ khánh thành.').waitFor();
  await row.getByText('Có trong Dòng thời gian').waitFor();
  await row.getByText('Có trong Phả ký').waitFor();
  await row.locator('img').first().waitFor();
  if ((await row.locator('img').count()) !== 2) throw new Error('phải hiện 2 ảnh của sự kiện');

  await page.goto(`${treeUrl}/dong-thoi-gian`);
  const entry = page.getByRole('listitem').filter({ hasText: 'Khánh thành nhà thờ họ' }).last();
  await entry.getByText('Sự kiện', { exact: true }).waitFor();
  await entry.locator('img').waitFor();
  await shot('25b-timeline-event');

  await page.goto(`${treeUrl}/pha-ky`);
  const phaKy = page.getByRole('listitem').filter({ hasText: 'Khánh thành nhà thờ họ' });
  await phaKy.getByText('Cả họ về dự lễ khánh thành.').waitFor();
  await phaKy.locator('img').waitFor();
  await shot('25c-pha-ky-event');

  // Xem lại sự kiện cũ theo khoảng thời gian: gồm cả sự kiện hằng năm đã diễn ra nhiều lần từ năm bắt đầu.
  await page.goto(`${treeUrl}/su-kien`);
  const panel = page.getByRole('region', { name: 'Tìm sự kiện' });
  await panel.getByLabel('Từ ngày').fill('2024-01-01');
  await panel.getByLabel('Đến ngày').fill('2026-12-31');
  await panel.getByText('Khánh thành nhà thờ họ').waitFor();
  await panel.getByText(/Họp họ đầu xuân/).first().waitFor();
  await panel.getByLabel('Tên', { exact: true }).fill('khanh thanh');
  await panel.getByText('1 kết quả').waitFor();
  await panel.getByText('Họp họ đầu xuân').waitFor({ state: 'detached' });
  await panel.getByLabel('Đến ngày').fill('2025-12-31');
  await panel.getByText('Không có sự kiện nào trong khoảng thời gian này.').waitFor();
  // Mặc định 30 ngày tới; lọc theo loại Giỗ/Sinh nhật/Sự kiện.
  await page.goto(`${treeUrl}/su-kien`);
  await panel.getByLabel('Loại').selectOption('gio');
  await panel.getByText('Họp họ đầu xuân').waitFor({ state: 'detached' });

  // Gỡ cờ hiển thị: sự kiện biến mất khỏi Dòng thời gian (Phả ký vẫn còn).
  await page.goto(`${treeUrl}/su-kien`);
  const panelAgain = page.getByRole('region', { name: 'Tìm sự kiện' });
  await panelAgain.getByLabel('Từ ngày').fill('2026-01-01');
  await panelAgain.getByLabel('Đến ngày').fill('2026-12-31');
  await panelAgain.getByLabel('Tên', { exact: true }).fill('Khánh thành');
  await page.getByRole('listitem').filter({ hasText: 'Khánh thành nhà thờ họ' }).getByRole('button', { name: 'Sửa' }).click();
  await page.getByRole('dialog').getByLabel('Đưa vào Dòng thời gian').uncheck();
  await page.getByRole('dialog').getByRole('button', { name: 'Lưu' }).click();
  await page.getByText('Có trong Dòng thời gian').waitFor({ state: 'detached' });
  await page.goto(`${treeUrl}/dong-thoi-gian`);
  await page.getByText('Khánh thành nhà thờ họ').waitFor({ state: 'detached', timeout: 5000 });
});

await step('Lịch của tôi và Sắp tới', async () => {
  await page.goto(`${APP}/lich?thang=2026-11`);
  await page.waitForTimeout(800);
  await shot('26-calendar');
  await page.goto(`${APP}/su-kien`);
  await page.waitForTimeout(800);
  await shot('27-upcoming');
  const [ics] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Xuất lịch 3 năm tới (.ics)' }).click(),
  ]);
  await ics.saveAs(`${SHOTS}/lich.ics`);
  const text = readFileSync(`${SHOTS}/lich.ics`, 'utf8');
  if (!text.startsWith('BEGIN:VCALENDAR') || !text.includes('BEGIN:VEVENT')) throw new Error('file .ics không hợp lệ');
  return `Sắp tới: ${(await page.locator('main').innerText()).split('\n').slice(0, 8).join(' | ')}`;
});

await step('bật link công khai', async () => {
  await page.goto(treeUrl);
  await page.getByRole('button', { name: 'Bật link công khai' }).click();
  await page.getByLabel('Đặt mật khẩu cho link').fill(PUBLIC_PASSWORD);
  await page.getByRole('button', { name: 'Bật link công khai' }).last().click();
  const input = page.getByRole('textbox', { name: 'Link chia sẻ công khai' });
  await input.waitFor();
  publicUrl = (await input.inputValue()).replace(/^https?:\/\/[^/]+/, APP);
  return publicUrl;
});

await step('khách chưa đăng nhập mở link, không thấy thông tin riêng tư', async () => {
  const guest = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const guestPage = await guest.newPage();
  await guestPage.goto(publicUrl);
  await guestPage.getByLabel('Mật khẩu').fill(PUBLIC_PASSWORD);
  await guestPage.getByRole('button', { name: 'Xem gia phả' }).click();
  await guestPage.getByRole('heading', { name: /Họ Phạm/ }).waitFor();
  await guestPage.waitForTimeout(600);
  await shot('28-public-tree', guestPage);
  await guestPage.getByLabel('Tìm người').fill('binh');
  await guestPage.getByRole('option').first().click();
  await guestPage.waitForTimeout(600);
  await guestPage.getByRole('button', { name: /Phạm Văn Bình/ }).first().click();
  await guestPage.waitForURL(/nguoi/);
  await shot('29-public-person-living', guestPage);
  const text = await guestPage.locator('main').innerText();
  const raw = await guestPage.evaluate(() => document.documentElement.innerHTML);
  await guest.close();
  if (text.includes('0912345678') || raw.includes('0912345678')) throw new Error('LỘ số điện thoại người còn sống');
  return text.replace(/\s+/g, ' ').slice(0, 160);
});

await step('mời Biên tập viên bằng email; họ thấy gia phả với đúng vai trò', async () => {
  const editorEmail = `editor-${Date.now()}@example.com`;
  const editor = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const editorPage = await editor.newPage();
  await editorPage.goto(`${APP}/dang-nhap`);
  await editorPage.getByRole('tab', { name: 'Tạo tài khoản' }).click();
  await editorPage.getByLabel('Email').fill(editorEmail);
  await editorPage.getByLabel('Họ và tên').fill('Người Thử');
  await editorPage.getByLabel('Ngày sinh').fill('1990-01-01');
  await editorPage.getByLabel('Số điện thoại').fill('0901234567');
  await editorPage.locator('input[type=password]').first().fill('matkhau123');
  await editorPage.getByRole('button', { name: 'Tạo tài khoản' }).last().click();
  await editorPage.waitForURL(/\/gia-pha$/);

  await page.goto(treeUrl);
  await page.getByRole('button', { name: '+ Thêm quản trị' }).click();
  await page.getByLabel('Email tài khoản').fill(editorEmail);
  await page.getByLabel('Vai trò').selectOption('viewer');
  await page.getByRole('button', { name: 'Mời', exact: true }).click();
  await page.getByText(editorEmail).waitFor();
  await shot('31b-members');

  await editorPage.goto(treeUrl);
  await editorPage.getByText('Vai trò của bạn: Người xem').waitFor();
  await editor.close();
});

await step('Phả đồ: xem trước, xuất PDF và PNG', async () => {
  await page.goto(`${treeUrl}/pha-do`);
  await page.locator('summary', { hasText: 'Trang trí' }).click();
  await page.getByLabel('Phụ đề').fill('Kính dâng tổ tiên – năm 2026');
  await page.getByLabel('Câu đối – vế bên trái').fill('Uống nước nhớ nguồn');
  await page.getByLabel('Câu đối – vế bên phải').fill('Ăn quả nhớ kẻ trồng cây');
  await page.getByText('Khổ giấy & chữ').click();
  await page.getByLabel('Khổ giấy').selectOption('A2');
  await page.waitForTimeout(500);
  await shot('30-pha-do');
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Xuất PDF/ }).click()]);
  await pdf.saveAs(`${SHOTS}/pha-do.pdf`);
  const [png] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.getByRole('button', { name: /Xuất ảnh PNG/ }).click(),
  ]);
  await png.saveAs(`${SHOTS}/pha-do.png`);
  const [width, height] = pdfPageSize(`${SHOTS}/pha-do.pdf`);
  // A2 ngang: 594 × 420 mm = 1683,78 × 1190,55 pt.
  if (Math.abs(width - 1683.78) > 1 || Math.abs(height - 1190.55) > 1) throw new Error(`PDF sai khổ: ${width} × ${height}`);
  if (readFileSync(`${SHOTS}/pha-do.png`).subarray(0, 8).toString('hex') !== PNG_SIGNATURE) throw new Error('file PNG hỏng');
  return `PDF ${width.toFixed(2)} × ${height.toFixed(2)} pt (A2); PNG ${png.suggestedFilename()} ${statSync(`${SHOTS}/pha-do.png`).size} byte`;
});

await step('lưu cấu hình Phả đồ và mở lại', async () => {
  await page.getByRole('button', { name: /Lưu cấu hình/ }).click();
  await page.getByRole('button', { name: 'Đã lưu cấu hình' }).waitFor();
  await page.reload();
  // Cấu hình đã lưu được nạp bất đồng bộ sau khi trang hiện.
  await page
    .waitForFunction(() => [...document.querySelectorAll('input')].some((input) => input.value === 'Kính dâng tổ tiên – năm 2026'), null, { timeout: 15000 })
    .catch(async () => {
      throw new Error(`mở lại ra "${await page.getByLabel('Phụ đề').inputValue()}"`);
    });
});

await step('xuất Excel', async () => {
  await page.goto(treeUrl);
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất Excel' }).click()]);
  await file.saveAs(`${SHOTS}/xuat.xlsx`);
  return `${file.suggestedFilename()} (${statSync(`${SHOTS}/xuat.xlsx`).size} byte)`;
});

await step('xoá người có con cháu đòi gõ tên', async () => {
  await page.getByRole('link', { name: /Phạm Văn Tổ/ }).first().click();
  await page.getByRole('main').getByRole('link', { name: /Phạm Văn (?!Tổ)/ }).first().click();
  await page.getByRole('button', { name: 'Xoá người này' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('không còn nối vào cây').waitFor();
  const button = dialog.getByRole('button', { name: 'Xoá vĩnh viễn' });
  if (!(await button.isDisabled())) throw new Error('nút xoá không bị khoá khi chưa gõ tên');
  await shot('31-delete-dialog');
  await dialog.getByRole('button', { name: 'Huỷ' }).click();
});

reportProblems(problems);
// walk-mobile dùng lại gia phả này.
writeFileSync(`${SHOTS}/walk-2.json`, JSON.stringify({ email, treeUrl, publicUrl }));
console.log('EMAIL', email, 'TREE', treeUrl, 'PUBLIC', publicUrl);
await browser.close();
