// Phả đồ: nhập Rộng/Cao trên 100 cm gõ được; tăng cỡ chữ ô thì khổ giấy tự chuyển "Tự nhập" và Rộng/Cao tự lớn; nhóm Cỡ chữ cạnh ô chữ.
import { APP, makeStep, openBrowser, reportProblems, SHOTS } from './walk-lib.mjs';

const { browser, page, problems } = await openBrowser();
const step = makeStep(() => page);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

let treeUrl = '';
await step('đăng ký, tạo gia phả, thêm Thuỷ tổ và 3 con', async () => {
  await page.goto(`${APP}/`);
  await page.waitForURL(/dang-nhap/);
  await page.getByRole('tab', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(`pha-do-${Date.now()}@example.com`);
  await page.getByLabel('Họ và tên').fill('Người Thử');
  await page.getByLabel('Ngày sinh').fill('1990-01-01');
  await page.getByLabel('Số điện thoại').fill('0901234567');
  await page.locator('input[type=password]').first().fill('matkhau123');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).last().click();
  await page.waitForURL(/\/gia-pha$/);
  await page.getByRole('button', { name: /Tạo gia phả/ }).first().click();
  await page.getByLabel('Tên gia phả').fill('Họ Phả Đồ');
  await page.getByRole('dialog').getByRole('button', { name: 'Tạo gia phả' }).click();
  await page.waitForURL(/\/gia-pha\/[0-9a-f-]{36}$/);
  treeUrl = page.url();
  await page.getByRole('button', { name: 'Thêm Thuỷ tổ' }).click();
  await page.getByRole('dialog').getByLabel('Họ và tên').fill('Cha Tổ');
  await page.getByRole('dialog').getByRole('button', { name: 'Thêm', exact: true }).click();
  await page.getByRole('link', { name: /Cha Tổ/ }).first().click();
  await page.waitForURL(/nguoi/);
  // Người đầu tiên không tự là Thuỷ tổ: đặt rõ ràng để Phả ký có dòng Thuỷ tổ.
  await page.getByRole('button', { name: 'Đặt làm Thuỷ tổ' }).click();
  await page.getByText('Thuỷ tổ', { exact: true }).first().waitFor();
  for (const name of ['Con A', 'Con B', 'Con C']) {
    await page.getByRole('button', { name: '+ Thêm con' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Họ và tên').fill(name);
    await dialog.getByRole('button', { name: 'Thêm con', exact: true }).click();
    await page.getByText(name, { exact: true }).first().waitFor();
  }
});

const tab = (name) => page.getByRole('tab', { name }).click();
const paperChoice = () => page.locator('[role=radiogroup][aria-label="Khổ giấy"] [aria-checked=true]').textContent();
const choosePaper = (name) => page.getByRole('radio', { name, exact: true }).click();
const stats = () => page.getByText(/mm · chữ tên/).textContent();
const memberFont = () => page.getByLabel('Cỡ chữ tên trong ô thành viên');

await step('thanh bên: 3 tab, thanh xuất luôn hiện, mỗi lúc một nhóm', async () => {
  await page.goto(`${treeUrl}/pha-do`);
  const group = page.getByRole('tablist', { name: 'Nhóm thiết lập' });
  await group.waitFor();
  assert((await group.getByRole('tab').count()) === 3, 'không có đúng 3 tab');
  assert((await group.getByRole('tab', { selected: true }).textContent()).includes('Nội dung'), 'tab mặc định không phải Nội dung');
  assert((await page.getByRole('radio', { name: 'Cả gia phả' }).count()) === 1, 'thiếu thanh phạm vi');
  assert((await page.getByLabel('Tiêu đề', { exact: true }).count()) === 0, 'nhóm Trang trí hiện cùng lúc với Nội dung');
  for (const name of ['Nội dung', 'Trang trí', 'Khổ giấy & chữ']) {
    await tab(name);
    assert(await page.getByRole('button', { name: /Xuất PDF/ }).isVisible(), `thanh xuất mất ở tab ${name}`);
  }
});

await step('thanh bên: mũi tên chuyển tab, chỉ tab đang chọn nằm trong thứ tự Tab', async () => {
  await tab('Nội dung');
  await page.getByRole('tab', { name: 'Nội dung' }).focus();
  await page.keyboard.press('ArrowRight');
  assert((await page.getByRole('tab', { name: 'Trang trí' }).getAttribute('aria-selected')) === 'true', 'ArrowRight không chuyển sang Trang trí');
  assert((await page.getByRole('tab', { name: 'Trang trí' }).evaluate((el) => document.activeElement === el)) === true, 'tiêu điểm không theo tab mới');
  assert((await page.getByRole('tab', { name: 'Nội dung' }).getAttribute('tabindex')) === '-1', 'tab không chọn vẫn nằm trong thứ tự Tab');
  await page.keyboard.press('End');
  assert((await page.getByRole('tab', { name: 'Khổ giấy & chữ' }).getAttribute('aria-selected')) === 'true', 'End không về tab cuối');
  await page.keyboard.press('ArrowRight');
  assert((await page.getByRole('tab', { name: 'Nội dung' }).getAttribute('aria-selected')) === 'true', 'ArrowRight không quay vòng');
});

await step('mở Phả đồ: khổ A1, cỡ chữ ô mặc định là số đang hiện; chọn Tự nhập bắt đầu từ khổ đang dùng', async () => {
  await tab('Khổ giấy & chữ');
  // Cây 4 người trên A1 ngang: chữ chạm trần 28 pt = 37,33 px; cỡ chữ mặc định là số đang hiện, làm tròn xuống.
  assert((await memberFont().inputValue()) === '37', `cỡ chữ ô mặc định ${await memberFont().inputValue()}`);
  assert((await paperChoice()) === 'A1', `khổ mặc định ${await paperChoice()}`);
  await choosePaper('Tự nhập');
  assert((await page.getByLabel('Rộng').inputValue()) === '84.1', `Rộng ${await page.getByLabel('Rộng').inputValue()}`);
  assert((await page.getByLabel('Cao').inputValue()) === '59.4', `Cao ${await page.getByLabel('Cao').inputValue()}`);
});

await step('gõ Rộng 150, Cao 120 từng phím: không bị đổi giữa chừng', async () => {
  for (const [label, value] of [['Rộng', '150'], ['Cao', '120']]) {
    const field = page.getByLabel(label);
    await field.click();
    await field.press('ControlOrMeta+a');
    await field.pressSequentially(value, { delay: 60 });
    assert((await field.inputValue()) === value, `${label} đang là "${await field.inputValue()}"`);
  }
  await page.getByLabel('Rộng').press('Tab');
  assert((await page.getByLabel('Rộng').inputValue()) === '150', 'Rộng mất giá trị sau khi rời ô');
  assert(/150 × 120|1500 × 1200/.test(await stats()), 'xem trước không theo kích thước mới');
});

await step('gõ ngoài khoảng rồi rời ô thì kẹp vào 10–500', async () => {
  const field = page.getByLabel('Rộng');
  await field.press('ControlOrMeta+a');
  await field.pressSequentially('900');
  await field.press('Tab');
  assert((await field.inputValue()) === '500', `Rộng ${await field.inputValue()}`);
  await field.press('ControlOrMeta+a');
  await field.pressSequentially('150');
  await field.press('Tab');
});

await step('tăng cỡ chữ ô: khổ giấy chuyển Tự động, Rộng/Cao tự lớn theo', async () => {
  await choosePaper('A3');
  const field = memberFont();
  await field.press('ControlOrMeta+a');
  await field.pressSequentially('300');
  await field.press('Tab');
  assert((await paperChoice()) === 'Tự động', `khổ giấy đang ${await paperChoice()}`);
  const width = Number(await page.getByLabel('Rộng').inputValue());
  const height = Number(await page.getByLabel('Cao').inputValue());
  assert(width > 42 && height > 29.7, `Rộng × Cao ${width} × ${height} chưa tăng`);
  assert(await page.getByLabel('Rộng').isDisabled(), 'Rộng sửa được khi khổ tự động');
  await shot('pha-do-font-lon');
});

await step('giảm cỡ chữ ô: khổ giấy tự thu nhỏ vừa khít', async () => {
  const widthBefore = Number(await page.getByLabel('Rộng').inputValue());
  const field = memberFont();
  await field.press('ControlOrMeta+a');
  await field.pressSequentially('100');
  await field.press('Tab');
  const widthAfter = Number(await page.getByLabel('Rộng').inputValue());
  assert((await paperChoice()) === 'Tự động', 'khổ giấy rời Tự động');
  assert(widthAfter < widthBefore * 0.5, `Rộng ${widthBefore} → ${widthAfter} chưa thu nhỏ`);
});

await step('khổ tự động: đổi nội dung (thêm dòng Ngày giỗ) thì khổ giấy tự co giãn theo', async () => {
  const before = await stats();
  await tab('Nội dung');
  await page.getByRole('button', { name: 'Ngày giỗ' }).click();
  const after = await stats();
  assert(after !== before, `kích thước không đổi: ${before}`);
  await page.getByRole('button', { name: 'Ngày giỗ' }).click();
});

await step('chọn khổ A1 cố định: đổi nội dung thì khổ giữ nguyên', async () => {
  await tab('Khổ giấy & chữ');
  await choosePaper('A1');
  await tab('Nội dung');
  await page.getByRole('button', { name: 'Đời', exact: true }).click();
  await tab('Khổ giấy & chữ');
  assert((await paperChoice()) === 'A1', `khổ giấy đổi thành ${await paperChoice()} dù đã cố định`);
  await tab('Nội dung');
  await page.getByRole('button', { name: 'Đời', exact: true }).click();
});

await step('Nội dung: tối đa 2 dòng chữ, chip còn lại mờ đi', async () => {
  await page.getByRole('button', { name: 'Ngày giỗ' }).click();
  await page.getByRole('button', { name: 'Đời', exact: true }).click();
  assert(await page.getByRole('button', { name: 'Nguyên quán' }).isDisabled(), 'chip thứ 3 vẫn bấm được');
  await page.getByRole('button', { name: 'Ngày giỗ' }).click();
  await page.getByRole('button', { name: 'Đời', exact: true }).click();
});

await step('màu ô thành viên: đặt rồi về mặc định; thông báo cỡ chữ tính bằng px', async () => {
  await tab('Khổ giấy & chữ');
  const text = await stats();
  assert(/chữ tên ~[\d.]+ px/.test(text) && !/\bpt\b/.test(text), `thông báo: ${text}`);
  await page.getByLabel('Màu nền').fill('#ffeecc');
  await page.getByLabel('Màu chữ').fill('#003366');
  await page.getByRole('button', { name: /Về màu nền mặc định/ }).waitFor();
  assert((await page.locator('svg rect[fill="#ffeecc"]').count()) > 0, 'xem trước chưa có ô nền #ffeecc');
  await page.getByRole('button', { name: /Về màu nền mặc định/ }).click();
  await page.getByRole('button', { name: /Về màu chữ mặc định/ }).click();
  assert((await page.getByRole('button', { name: /mặc định/ }).count()) === 0, 'chưa về mặc định');
  assert((await page.locator('svg rect[fill="#ffeecc"]').count()) === 0, 'ô vẫn nền cũ sau khi về mặc định');
});

await step('gõ tiêu đề rồi đổi màu ngay: khổ giấy vẫn tự co giãn khi ngừng gõ (không bị huỷ lần tính hoãn)', async () => {
  await tab('Khổ giấy & chữ');
  await choosePaper('Tự động');
  const before = `${await page.getByLabel('Rộng').inputValue()}×${await page.getByLabel('Cao').inputValue()}`;
  await tab('Trang trí');
  await page.getByLabel('Tiêu đề', { exact: true }).fill('Gia phả dòng họ Phạm Văn ở làng Đông, huyện Thanh Chương, tỉnh Nghệ An, nhiều đời tiếp nối');
  await tab('Khổ giấy & chữ');
  await page.getByLabel('Màu nền').fill('#ffeecc'); // đổi màu trong lúc lần tính hoãn của tiêu đề còn chờ
  await page.waitForTimeout(1200);
  const after = `${await page.getByLabel('Rộng').inputValue()}×${await page.getByLabel('Cao').inputValue()}`;
  assert(after !== before, `khổ giấy không đổi sau khi gõ tiêu đề dài (${before})`);
  await page.getByRole('button', { name: /Về màu nền mặc định/ }).click();
  await tab('Trang trí');
  await page.getByLabel('Tiêu đề', { exact: true }).fill('');
});

await step('Trang trí: cỡ chữ cùng hàng phía trên ô chữ tương ứng, mặc định 50/30/30', async () => {
  await tab('Trang trí');
  const input = await page.getByLabel('Tiêu đề', { exact: true }).boundingBox();
  const size = await page.getByLabel('Cỡ chữ tiêu đề').boundingBox();
  assert(size.y < input.y && input.y - size.y < 60, 'ô cỡ chữ không ngay trên ô Tiêu đề');
  assert(Math.abs(size.x + size.width - (input.x + input.width)) < 4, 'ô cỡ chữ không căn mép phải với ô Tiêu đề');
  const sizes = [];
  for (const name of ['Cỡ chữ tiêu đề', 'Cỡ chữ phụ đề', 'Cỡ chữ câu đối']) sizes.push(await page.getByLabel(name).inputValue());
  assert(sizes.join() === '50,30,30', `cỡ mặc định ${sizes.join()}`);
  assert((await page.getByRole('radio', { name: /Đỏ son/ }).count()) === 1, 'ảnh khung không hiện sẵn');
  assert((await page.getByRole('radiogroup', { name: 'Kiểu khung' }).getByRole('radio').count()) === 12, 'không đủ 12 kiểu khung');
  // Bấm vào nhãn như người dùng thật: ô radio ẩn (sr-only) chỉ rộng 1px nên bấm thẳng vào nó dễ trượt ra ngoài ô khi làm tròn điểm ảnh.
  const moc = page.getByRole('radio', { name: /Mộc/ });
  await page.getByRole('radiogroup', { name: 'Kiểu khung' }).locator('label', { has: moc }).click();
  assert(await moc.isChecked(), 'bấm ảnh khung Mộc mà chưa chọn');
  await shot('pha-do-trang-tri');
});

await step('Phả ký: bấm tên mở thành viên', async () => {
  await page.goto(`${treeUrl}/pha-ky`);
  await page.locator('article').first().waitFor();
  // Mỗi nội dung của thành viên một dòng riêng; tên trong mục Đời là liên kết mở hồ sơ.
  assert((await page.locator('article p').count()) >= 4, 'nội dung thành viên chưa tách dòng');
  await page.locator('article h3').getByRole('link', { name: 'Cha Tổ' }).click();
  await page.waitForURL(/\/nguoi\/[0-9a-f-]{36}$/);
});

await step('nút gọi API khoá ngay khi bấm: bấm đúp "Lưu cấu hình" chỉ gửi một lần', async () => {
  await page.goto(`${treeUrl}/pha-do`);
  const save = page.getByRole('button', { name: /Lưu cấu hình/ });
  await save.waitFor();
  const writes = [];
  page.on('request', (request) => {
    if (request.url().includes('pha_do_configs') && request.method() !== 'GET') writes.push(request.method());
  });
  // Làm chậm phản hồi để lần bấm thứ hai rơi vào lúc đang gọi.
  await page.route('**/pha_do_configs*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await save.dblclick();
  await page.getByRole('button', { name: 'Đã lưu cấu hình' }).waitFor();
  await page.unroute('**/pha_do_configs*');
  assert(writes.length === 1, `bấm đúp gửi ${writes.length} lần (${writes.join(',')})`);
});

await step('Biên tập viên sửa được Người do Chủ sở hữu tạo; xoá thì gửi yêu cầu chờ Chủ sở hữu duyệt', async () => {
  const editorEmail = `bt-${Date.now()}@example.com`;
  const editor = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'vi-VN' });
  const editorPage = await editor.newPage();
  await editorPage.goto(`${APP}/dang-nhap`);
  await editorPage.getByRole('tab', { name: 'Tạo tài khoản' }).click();
  await editorPage.getByLabel('Email').fill(editorEmail);
  await editorPage.getByLabel('Họ và tên').fill('Biên Tập');
  await editorPage.getByLabel('Ngày sinh').fill('1990-01-01');
  await editorPage.getByLabel('Số điện thoại').fill('0901234567');
  await editorPage.locator('input[type=password]').first().fill('matkhau123');
  await editorPage.getByRole('button', { name: 'Tạo tài khoản' }).last().click();
  await editorPage.waitForURL(/\/gia-pha$/);

  await page.goto(treeUrl);
  await page.getByRole('button', { name: '+ Thêm quản trị' }).click();
  await page.getByLabel('Email tài khoản').fill(editorEmail);
  await page.getByLabel('Vai trò').selectOption('editor');
  await page.getByRole('button', { name: 'Mời', exact: true }).click();
  await page.getByText(editorEmail).waitFor();

  await editorPage.goto(treeUrl);
  await editorPage.getByText('Vai trò của bạn: Biên tập viên').waitFor();
  // Con A do Chủ sở hữu tạo: Biên tập viên vẫn sửa được.
  await editorPage.getByRole('link', { name: /Cha Tổ/ }).first().click();
  await editorPage.getByRole('link', { name: /Con A/ }).first().click();
  await editorPage.getByRole('button', { name: 'Sửa thông tin' }).click();
  const dialog = editorPage.getByRole('dialog');
  const more = dialog.getByRole('button', { name: /Thêm thông tin/ });
  if (await more.count()) await more.click();
  await dialog.getByLabel('Nghề nghiệp').fill('Thợ mộc');
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await editorPage.getByText('Thợ mộc').waitFor();
  // Xoá: chỉ gửi yêu cầu, Người vẫn còn.
  assert((await editorPage.getByRole('button', { name: 'Xoá người này' }).count()) === 0, 'Biên tập viên thấy nút xoá ngay');
  await editorPage.getByRole('button', { name: 'Gửi yêu cầu xoá' }).click();
  await editorPage.getByRole('dialog').getByRole('button', { name: 'Gửi yêu cầu xoá' }).click();
  await editorPage.getByText(/Đang chờ Chủ sở hữu duyệt/).waitFor();
  await editor.close();
});

await step('Người phụ trách cúng giỗ: không liệt kê sẵn, gõ tên mới có kết quả', async () => {
  await page.goto(treeUrl);
  await page.getByRole('link', { name: /Cha Tổ/ }).first().click();
  await page.getByRole('button', { name: 'Sửa thông tin' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Đã mất').check();
  const keeper = dialog.getByLabel('Người phụ trách cúng giỗ');
  await keeper.waitFor();
  assert((await dialog.getByRole('button', { name: /Con [ABC]/ }).count()) === 0, 'danh sách người hiện sẵn khi chưa gõ');
  await keeper.fill('con b');
  await dialog.getByRole('button', { name: /Con B/ }).click();
  assert((await dialog.getByRole('button', { name: 'Bỏ chọn' }).count()) === 1, 'chưa chọn được người phụ trách');
  await dialog.getByRole('button', { name: 'Bỏ chọn' }).click();
  await keeper.waitFor();
  await dialog.getByRole('button', { name: 'Huỷ' }).click().catch(() => {});
});

await step('Phả ký: tuỳ chọn nội dung tóm tắt, nhớ lựa chọn khi tải lại', async () => {
  await page.goto(`${treeUrl}/pha-ky`);
  await page.locator('article').first().waitFor();
  const lines = () => page.locator('article p').count();
  const all = await lines();
  assert(all >= 4, 'thiếu dòng tóm tắt');
  // Khối tuỳ chọn gập sẵn (đỡ chiếm màn hình điện thoại): mở ra trước khi bấm chip.
  const openOptions = () => page.getByText('Hiển thị trong tóm tắt từng người').click();
  await openOptions();
  // Mặc định chỉ bật Tên gọi khác, Cha mẹ, Chức vụ & vai vế; Thứ tự con không chọn sẵn.
  const pressed = async (name) => (await page.getByRole('button', { name, exact: true }).getAttribute('aria-pressed')) === 'true';
  assert((await pressed('Cha mẹ')) && (await pressed('Tên gọi khác')) && (await pressed('Chức vụ & vai vế')), 'mặc định thiếu nhóm');
  assert(!(await pressed('Thứ tự con')) && !(await pressed('Nghề nghiệp')), 'mặc định bật thừa nhóm (Thứ tự con phải không chọn sẵn)');
  assert(!(await page.locator('article').getByText('Con trưởng.').count()), 'Thứ tự con hiện dù không chọn');
  await page.getByRole('button', { name: 'Cha mẹ', exact: true }).click();
  assert(!(await pressed('Cha mẹ')), 'chip chưa tắt');
  assert((await lines()) === 0, `bỏ Cha mẹ rồi vẫn còn ${await lines()} dòng`);
  await page.reload();
  await page.locator('article').first().waitFor();
  assert((await lines()) === 0, 'lựa chọn không được nhớ sau khi tải lại');
  await openOptions();
  await page.getByRole('button', { name: 'Chọn tất cả' }).click();
  assert((await pressed('Nghề nghiệp')) && (await pressed('Thứ tự con')), 'Chọn tất cả chưa bật hết');
  await page.getByText('Con trưởng.').first().waitFor();
});

await step('Tra cứu: Đặt tên cho Bé — chọn Ba/Mẹ suy ra Đời, liệt kê người trùng kèm lý do và quan hệ', async () => {
  await page.goto(`${treeUrl}/quan-he`);
  await page.getByRole('tab', { name: 'Đặt tên cho Bé' }).click();
  assert((await page.getByLabel('Đời của Bé').count()) === 0, 'vẫn còn ô nhập Đời của Bé');
  assert((await page.getByLabel('Mẹ', { exact: true }).count()) === 0, 'vẫn còn ô nhập Mẹ riêng');
  await page.getByLabel('Họ và tên của Bé').fill('Phạm Tổ A');
  await page.getByText('Chọn Ba/Mẹ của Bé để xem kết quả.').waitFor();
  assert((await page.getByText(/người trùng/).count()) === 0, 'chưa chọn Cha/Mẹ mà đã có kết quả');
  // Ba là Con A (Đời 2) → Bé thuộc Đời 3. Tên "A" trùng Con A (cha); tên lót "Tổ" trùng Cha Tổ (Đời 1).
  await page.getByLabel('Ba/Mẹ', { exact: true }).fill('con a');
  await page.getByRole('button', { name: /Con A/ }).click();
  await page.getByText('Bé thuộc Đời 3').waitFor();
  await page.getByText(/Có 2 người trùng/).waitFor();
  await page.getByText('tên "A" trùng với tên của Bé').waitFor();
  await page.getByText('tên "Tổ" trùng với tên lót "Tổ" của Bé').waitFor();
  const text = await page.locator('main').textContent();
  assert(text.includes('Quan hệ với Bé: Ba'), 'Con A phải là Ba của Bé');
  assert(text.includes('Quan hệ với Bé: Ông nội'), 'Cha Tổ phải là Ông nội của Bé');
  // Tên "B" trùng Con B: em của cha → chú ruột.
  await page.getByLabel('Họ và tên của Bé').fill('Phạm Hữu B');
  await page.getByText('Quan hệ với Bé: Chú ruột').waitFor();
  await shot('tra-cuu-dat-ten');
  await page.getByLabel('Họ và tên của Bé').fill('Phạm Hữu Khôi');
  await page.getByText(/Không trùng với ai/).waitFor();
});

async function shot(name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

await browser.close();
reportProblems(problems);
