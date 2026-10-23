// Trao quyền Chủ sở hữu (Chủ sở hữu tự trao, và siêu quản trị đổi trên trang Quản trị), mục "Năm tháng có thể sai" ở Cần cập nhật, mã QR của link công khai.
import { readFileSync } from 'node:fs';
import { APP, makeStep, openBrowser, reportProblems, SHOTS } from './walk-lib.mjs';

const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:54321';
const KEY = 'local-anon-key';
const PASSWORD = 'matkhau123';
const ROOT_EMAIL = 'trungpham168@gmail.com';

const { browser, page, problems } = await openBrowser();
const step = makeStep(() => page);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const stamp = Date.now();
const ownerEmail = `chu-trao-${stamp}@example.com`;
const editorEmail = `bt-nhan-${stamp}@example.com`;
const viewerEmail = `xem-${stamp}@example.com`;
let treeId = '';

// Dựng dữ liệu qua API (nhanh hơn bấm từng Người): tài khoản, gia phả, Người có năm sinh mâu thuẫn, vai trò.
const signUpApi = async (email) => {
  const response = await fetch(`${API}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, data: { full_name: 'Thử Nghiệm', birth_date: '1990-01-01', phone: '0901234567' } }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`đăng ký ${email}: ${JSON.stringify(body)}`);
  return body.access_token;
};
const restAs = (token) => async (path, body) => {
  const response = await fetch(`${API}/rest/v1/${path}`, {
    method: 'POST',
    headers: { apikey: KEY, authorization: `Bearer ${token}`, 'content-type': 'application/json', prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path}: ${text}`);
  return text ? JSON.parse(text) : null;
};

const signIn = async (target, email) => {
  await target.goto(`${APP}/dang-nhap`);
  await target.getByLabel('Email').fill(email);
  await target.locator('input[type=password]').first().fill(PASSWORD);
  await target.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await target.waitForURL(/\/gia-pha$/);
};

await step('dựng dữ liệu: Chủ sở hữu, Biên tập viên, Người xem; cây có năm sinh mâu thuẫn', async () => {
  const ownerToken = await signUpApi(ownerEmail);
  await signUpApi(editorEmail);
  await signUpApi(viewerEmail);
  const call = restAs(ownerToken);
  const [tree] = await call('family_trees', { name: 'Họ Trao Quyền' });
  treeId = tree.id;
  const person = async (full_name, fields) => (await call('persons?select=id', { tree_id: treeId, full_name, ...fields }))[0].id;
  const to = await person('Phạm Văn Tổ', { gender: 'nam', birth_year: 1900, death_year: 1960, is_deceased: true });
  const ba = await person('Nguyễn Thị Bà', { gender: 'nu', birth_year: 1880 });
  const con = await person('Phạm Văn Con', { gender: 'nam', birth_year: 1965 });
  const chau = await person('Phạm Văn Cháu', { gender: 'nam', birth_year: 1990 });
  const khoang = await person('Phạm Văn Khoảng', { gender: 'nam', birth_year: 1970, birth_approx: true });
  for (const [child, parent] of [[con, to], [con, ba], [chau, con], [khoang, chau]]) {
    await call('rpc/link_parent', { child_id: child, parent_id: parent, link_kind: 'ruot' });
  }
  await call('rpc/invite_to_tree', { target_tree: treeId, invite_email: editorEmail, new_role: 'editor' });
  await call('rpc/invite_to_tree', { target_tree: treeId, invite_email: viewerEmail, new_role: 'viewer' });
});

await step('Cần cập nhật: liệt kê năm tháng mâu thuẫn, bỏ qua năm ghi "khoảng" và người hợp lý', async () => {
  await signIn(page, ownerEmail);
  await page.goto(`${APP}/gia-pha/${treeId}/thieu-thong-tin`);
  await page.getByRole('heading', { name: 'Năm tháng có thể sai' }).waitFor();
  const section = page.locator('section', { has: page.getByRole('heading', { name: 'Năm tháng có thể sai' }) });
  for (const text of [
    'Sinh năm 1965, sau khi cha Phạm Văn Tổ mất (1960)',
    'Sinh năm 1965, khi mẹ Nguyễn Thị Bà (sinh 1880) đã ngoài 55 tuổi',
    'Đang ghi còn sống nhưng đã',
  ]) {
    await section.getByText(text).first().waitFor();
  }
  const listed = await section.locator('a').allTextContents();
  assert(!listed.some((name) => name.includes('Phạm Văn Cháu') || name.includes('Phạm Văn Khoảng')), `liệt kê nhầm: ${listed.join(' | ')}`);
  await page.screenshot({ path: `${SHOTS}/nam-thang-co-the-sai.png`, fullPage: true });
});

await step('mã QR: hiện mã của link công khai, tải được ảnh PNG để in', async () => {
  await page.goto(`${APP}/gia-pha/${treeId}`);
  await page.getByRole('button', { name: 'Bật link công khai' }).click();
  await page.getByLabel('Đặt mật khẩu cho link').fill('thu1234');
  await page.getByRole('button', { name: 'Bật link công khai' }).click();
  const link = await page.getByRole('textbox', { name: 'Link chia sẻ công khai' }).inputValue();
  await page.getByRole('button', { name: 'Mã QR', exact: true }).click();
  const qr = page.getByRole('img', { name: 'Mã QR của link chia sẻ công khai' });
  await qr.waitFor();

  // Giải mã bằng BarcodeDetector khi trình duyệt có (Chromium trên macOS); không có thì chỉ kiểm ảnh tải về.
  const decoded = await qr.evaluate(async (svg) => {
    if (!('BarcodeDetector' in window)) return null;
    const xml = new XMLSerializer().serializeToString(svg).replace('<svg', '<svg width="400" height="400"');
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 400;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 400, 400);
    context.drawImage(image, 0, 0, 400, 400);
    const codes = await new BarcodeDetector({ formats: ['qr_code'] }).detect(canvas).catch(() => null);
    return codes ? codes.map((code) => code.rawValue) : null;
  });
  if (decoded) assert(decoded[0] === link, `QR giải ra "${decoded[0]}", link là "${link}"`);

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Tải ảnh để in' }).click()]);
  const name = download.suggestedFilename();
  assert(/^Ma-QR-Họ-Trao-Quyền-\d{4}-\d{2}-\d{2}\.png$/.test(name), `tên file: ${name}`);
  await download.saveAs(`${SHOTS}/ma-qr.png`);
  const png = readFileSync(`${SHOTS}/ma-qr.png`);
  assert(png.subarray(1, 4).toString() === 'PNG', 'file tải về không phải PNG');
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  // (số ô + 2 × 4 ô viền) × 16 px; cao hơn rộng đúng phần chú thích 72 px.
  assert(width % 16 === 0 && width >= (21 + 8) * 16 && height === width + 72, `kích thước ảnh ${width}×${height}`);
  await page.screenshot({ path: `${SHOTS}/ma-qr-panel.png`, fullPage: true });
  return `${name}, ${width}×${height}${decoded ? ', giải mã khớp link' : ', trình duyệt không có BarcodeDetector'}`;
});

await step('trao quyền: chỉ Biên tập viên có nút; Huỷ thì không đổi; xác nhận thì đổi vai trò, khung của Chủ sở hữu ẩn', async () => {
  const rowOf = (email) => page.locator('li', { has: page.getByText(email, { exact: true }) });
  assert((await rowOf(viewerEmail).getByRole('button', { name: 'Trao quyền Chủ sở hữu' }).count()) === 0, 'Người xem cũng có nút trao quyền');

  await rowOf(editorEmail).getByRole('button', { name: 'Trao quyền Chủ sở hữu' }).click();
  await page.getByText(`Trao quyền Chủ sở hữu cho ${editorEmail}?`).waitFor();
  await page.getByRole('button', { name: 'Huỷ', exact: true }).click();
  await rowOf(editorEmail).getByRole('button', { name: 'Trao quyền Chủ sở hữu' }).waitFor();
  await page.getByText('Vai trò của bạn: Chủ sở hữu').waitFor();

  await rowOf(editorEmail).getByRole('button', { name: 'Trao quyền Chủ sở hữu' }).click();
  await page.getByRole('button', { name: 'Trao quyền', exact: true }).click();
  await page.getByText('Vai trò của bạn: Biên tập viên').waitFor();
  await rowOf(editorEmail).getByText('Chủ sở hữu', { exact: true }).waitFor();
  await rowOf(ownerEmail).getByText('Biên tập viên', { exact: true }).waitFor();
  assert((await page.getByRole('heading', { name: 'Link chia sẻ công khai' }).count()) === 0, 'Biên tập viên vẫn thấy khung link công khai');
  assert((await page.getByRole('button', { name: '+ Thêm quản trị' }).count()) === 0, 'Biên tập viên vẫn thấy nút mời');
  assert((await page.getByRole('button', { name: 'Trao quyền Chủ sở hữu' }).count()) === 0, 'Biên tập viên vẫn thấy nút trao quyền');
  await page.screenshot({ path: `${SHOTS}/sau-trao-quyen.png`, fullPage: true });
});

await step('Chủ sở hữu mới: thấy vai trò Chủ sở hữu, quản lý được link và có thể trao lại', async () => {
  const other = await browser.newContext({ locale: 'vi-VN' });
  await other.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const heirPage = await other.newPage();
  await signIn(heirPage, editorEmail);
  await heirPage.goto(`${APP}/gia-pha/${treeId}`);
  await heirPage.getByText('Vai trò của bạn: Chủ sở hữu').waitFor();
  await heirPage.getByRole('heading', { name: 'Link chia sẻ công khai' }).waitFor();
  await heirPage.locator('li', { has: heirPage.getByText(ownerEmail, { exact: true }) }).getByRole('button', { name: 'Trao quyền Chủ sở hữu' }).waitFor();
  await other.close();
});

await step('siêu quản trị đổi Chủ sở hữu trên trang Quản trị: trao lại gia phả cho Chủ sở hữu cũ', async () => {
  // Gốc có thể đã đăng ký ở walk-4 (cùng backend): trùng thì bỏ qua.
  await signUpApi(ROOT_EMAIL).catch((error) => {
    if (!error.message.includes('already registered')) throw error;
  });
  const admin = await browser.newContext({ locale: 'vi-VN' });
  await admin.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const adminPage = await admin.newPage();
  await signIn(adminPage, ROOT_EMAIL);
  await adminPage.goto(`${APP}/quan-tri`);
  await adminPage.getByRole('tab', { name: /Tất cả/ }).click();
  await adminPage.getByLabel('Tìm theo họ tên, email hoặc số điện thoại').fill(editorEmail);
  const row = adminPage.locator('li', { has: adminPage.getByText(editorEmail, { exact: true }) });
  await row.getByRole('button', { name: 'Gia phả (1)' }).click();

  const dialog = adminPage.getByRole('dialog');
  await dialog.getByText('Họ Trao Quyền').waitFor();
  await dialog.getByRole('button', { name: 'Đổi Chủ sở hữu' }).click();
  await dialog.getByLabel('Email tài khoản nhận gia phả').fill(ownerEmail.toUpperCase());
  await dialog.getByRole('button', { name: 'Đổi Chủ sở hữu' }).click();
  await dialog.getByRole('status').filter({ hasText: `Đã chuyển "Họ Trao Quyền" cho ${ownerEmail}` }).waitFor();
  await dialog.getByText('Tài khoản này không còn sở hữu gia phả nào.').waitFor();
  await adminPage.screenshot({ path: `${SHOTS}/quan-tri-doi-chu.png`, fullPage: true });
  await dialog.getByRole('button', { name: /Đóng/ }).first().click();
  await row.getByRole('button', { name: /^Gia phả \(/ }).waitFor({ state: 'detached' });
  await admin.close();

  await page.goto(`${APP}/gia-pha/${treeId}`);
  await page.getByText('Vai trò của bạn: Chủ sở hữu').waitFor();
  await page.locator('li', { has: page.getByText(editorEmail, { exact: true }) }).getByRole('button', { name: 'Trao quyền Chủ sở hữu' }).waitFor();
});

await browser.close();
reportProblems(problems);
