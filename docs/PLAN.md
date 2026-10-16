# Plan — Webapp Gia Phả (v1)

Chốt ngày 2026-10-16 sau 3 vòng hỏi đáp. Thuật ngữ: xem `CONTEXT.md`. Quyết định khó đảo ngược: xem `docs/adr/`.

## 1. Mục tiêu và phạm vi

Webapp cho **nhiều dòng họ**: ai cũng tạo được gia phả riêng (tối đa 3/tài khoản), mỗi gia phả 500–2.000 Người. Chỉ tiếng Việt. Web responsive: sửa cây chủ yếu trên máy tính, xem và lịch tối ưu cho điện thoại.

**Có trong v1**
- Lưu đầy đủ thông tin Người qua nhiều đời, quan hệ tổng quát (nhiều hôn phối, con nuôi, thứ tự con, cháu ngoại).
- Xem Cây tương tác, danh sách theo đời, tìm kiếm.
- Nhập/xuất Excel.
- Chia sẻ: vai trò + link công khai rút gọn.
- Lịch âm dương, giỗ âm lịch, sinh nhật, sự kiện, nhắc trong app + bản tin email.
- Phả đồ in: PDF vector, PNG.
- Ảnh tư liệu, link vị trí mộ.

**Không có trong v1**: AI (phục chế ảnh, đọc file Word, trợ lý), ngày tốt xấu/xem tuổi, Zalo/SMS, app di động, quỹ họ, thắp hương ảo, chỉnh phả đồ kéo-thả từng ô, rồng chầu, lịch sử thay đổi và thùng rác.

## 2. Các quyết định đã chốt

| # | Chủ đề | Quyết định |
|---|---|---|
| Q1 | Đối tượng | Nhiều dòng họ (ADR 0001) |
| Q2 | Quy mô | 500–800 người/gia phả; giới hạn cứng 2.000 |
| Q3, Q19 | Chia sẻ | Link công khai rút gọn + vai trò đầy đủ (ADR 0002). Người còn sống trên link công khai: chỉ hiện tên, đời, quan hệ, năm sinh. Ẩn ngày-tháng sinh, SĐT, email, địa chỉ, tiểu sử, ảnh (kể cả ảnh đại diện), vị trí mộ. Mỗi Người có công tắc "ẩn hoàn toàn khỏi link công khai" |
| Q4 | Quyền | Chủ sở hữu / Biên tập viên / Người xem |
| Q5 | Quan hệ | Lưu tổng quát, lọc khi hiển thị (ADR 0003) |
| Q6, Q15 | Nhắc | Giỗ: in-app + email, hiển thị ngày âm, tính ngày dương từng năm. Sinh nhật: chỉ in-app, chỉ người còn sống. Mỗi tài khoản có Danh sách nhắc giỗ, mặc định tổ tiên trực hệ khoảng 4 đời. Chọn nhắc: đúng ngày / trước 1 / 3 / 7 ngày. Email là 1 bản tin/ngày lúc 7 giờ sáng |
| Q7, Q23 | Lịch | Lịch tháng âm + dương, can chi, tiết khí, giờ hoàng đạo, ngày lễ, chấm sự kiện; có trang lịch công khai. Không có ngày tốt xấu |
| Q8 | Quy tắc giỗ | Tháng nhuận → giỗ tháng thường. Ngày 30 không có → ngày cuối tháng. Nhắc theo chính kỵ, có tuỳ chọn tiên thường |
| Q9, Q22 | Phả đồ | Phạm vi: cả họ / một chi / từ một người xuống N đời. Khổ A3–A0 hoặc tự nhập, ngang/dọc. Ô: tên, năm sinh–mất, ảnh bật/tắt, 1–2 dòng tuỳ chọn. 2–3 mẫu khung, tiêu đề, phụ đề, câu đối dạng chữ. PDF vector mọi khổ; PNG 300 dpi đến A1 (A0 ≈ 200 dpi). Cảnh báo khi chữ quá nhỏ |
| Q10 | Nền tảng | Web responsive, tiếng Việt, có trường tên chữ Hán. Claude code toàn bộ |
| Q11 | Hạ tầng | Supabase + Cloudflare Pages/R2/Worker Cron + Resend, toàn bộ free (ADR 0004). Chạy `*.pages.dev` trước, mua tên miền khi cần email |
| Q12 | Trường thông tin | Danh sách đầy đủ ở mục 4, có mộ phần |
| Q13 | Ngày tháng | Ngày không đầy đủ (năm / tháng-năm / đủ, kèm "khoảng"), nhập âm hoặc dương |
| Q14 | Đăng nhập | Google + email/mật khẩu |
| Q16 | Cây | Mặc định từ trên xuống, có nút chuyển sang trái→phải. Mở sẵn 4 đời. Vợ chồng 2 ô cạnh nhau. Tìm người và "đưa tôi tới" |
| Q17 | Nhập liệu | Excel mẫu nối bằng mã số, có màn xem trước; xuất Excel cùng định dạng |
| Q18 | Giới hạn | 3 gia phả/tài khoản, 2.000 Người/gia phả, 5 ảnh/Người, ảnh nén ≤ 1.600 px, < 400 KB. Đều là cấu hình |
| Q20 | Mộ phần | Mô tả + dán link vị trí Google Maps; nút "Chỉ đường". Chỉ tài khoản có vai trò thấy |
| Q21 | Sửa đồng thời | Phát hiện xung đột khi hai người sửa cùng một Người; người lưu sau được báo và xem khác biệt. Không có lịch sử thay đổi và thùng rác ở v1 |
| Q24 | Giao diện | Phần quản lý: hiện đại, sạch, chữ to. Cây, Phả đồ, trang công khai: chất truyền thống |
| Q25 | Người chưa nối | Cho phép nhiều gốc tạm thời; có danh sách "Chưa nối vào cây" |
| Q26 | Thứ tự | 6 mốc ở mục 6 |

## 3. Kiến trúc

```
Trình duyệt (React SPA)
 ├─ đọc/ghi dữ liệu ──────► Supabase (Postgres + RLS + Auth)
 ├─ tải ảnh (URL ký sẵn) ─► Cloudflare R2
 ├─ xuất PDF/PNG phả đồ (chạy tại chỗ)
 └─ link công khai ───────► Cloudflare Pages Function → hàm SQL trả dữ liệu đã lọc

Cloudflare Worker Cron (00:00 UTC = 7:00 VN)
 ├─ tính nhắc nhở đến hạn → ghi thông báo in-app vào Supabase
 └─ gom bản tin → Resend (≤ 100 email/ngày)
```

- **Frontend**: React + TypeScript + Vite, Tailwind, TanStack Query, React Router. Cây vẽ bằng SVG, thuật toán bố cục tự viết (hỗ trợ nhiều hôn phối và lọc nhánh), d3-zoom để kéo/phóng.
- **Lịch âm**: thuật toán Hồ Ngọc Đức (múi giờ +7) viết thành gói TypeScript dùng chung cho web và Worker, có bộ test với các ngày đã biết.
- **Phả đồ**: tạo SVG từ cùng bố cục → jsPDF + svg2pdf (nhúng font tiếng Việt) cho PDF; canvas cho PNG.
- **Excel**: SheetJS, chạy trong trình duyệt.
- **Bảo mật**: mọi quyền kiểm tra bằng Row Level Security trong Postgres. Link công khai đi qua một hàm SQL chỉ trả về các trường được phép.
- **Sửa đồng thời**: mỗi Người có cột `version`; lưu kèm version cũ, lệch thì từ chối và trả về bản mới để so sánh.

## 4. Mô hình dữ liệu (dự kiến)

| Bảng | Nội dung chính |
|---|---|
| `family_trees` | tên, chủ sở hữu, mã link công khai (nullable), cài đặt hiển thị |
| `tree_roles` | tài khoản, gia phả, vai trò, Người được liên kết |
| `persons` | gia phả; định danh (họ tên, tên thường gọi, tên huý, tên tự/hiệu, tên chữ Hán, giới tính); sinh (ngày không đầy đủ + lịch, nơi sinh); đời sống (quê quán, nơi ở, nghề, học vấn, chức vụ, SĐT, email, tiểu sử); mất (ngày mất không đầy đủ + lịch, ngày giỗ âm, nơi an táng, link vị trí mộ, nơi thờ, người phụ trách cúng); thứ tự con; ghi chú vai vế; ẩn khỏi công khai; `version` |
| `parent_links` | con, cha/mẹ, loại (ruột / nuôi) |
| `unions` | hai Người, thứ tự hôn phối mỗi bên, trạng thái (còn / ly hôn / goá) |
| `photos` | Người, khoá R2, chú thích, là ảnh đại diện |
| `events` | gia phả, loại (giỗ / sinh nhật / tuỳ chỉnh), Người (nếu có), ngày + lịch âm/dương, lặp hằng năm |
| `reminder_watch` | tài khoản, Người (Danh sách nhắc giỗ) |
| `reminder_prefs` | tài khoản, gia phả, thời điểm nhắc, bật/tắt email |
| `notifications` | tài khoản, nội dung, ngày, đã đọc |
| `chart_layouts` | gia phả, cấu hình phả đồ đã lưu (khổ, mẫu, phạm vi, tiêu đề…) |

Giỗ và sinh nhật được **suy ra** từ `persons`, không lưu trùng thành `events`. `events` chỉ dành cho họp họ và ngày tự tạo.

## 5. Ngày giỗ: luật tính

1. Nếu có ngày mất âm (ngày + tháng): giỗ = ngày đó. Nếu chỉ có ngày mất dương đầy đủ: đổi sang âm một lần rồi lưu.
2. Tháng nhuận → dùng tháng thường cùng số.
3. Mỗi năm: tìm ngày dương tương ứng. Nếu tháng âm năm đó không có ngày 30 → lấy ngày cuối tháng (29).
4. Nhắc: ngày giỗ − số ngày đã chọn (0 / 1 / 3 / 7).

## 6. Các mốc phát triển

Mỗi mốc deploy lên `*.pages.dev`, bạn dùng thử rồi mới sang mốc tiếp.

| Mốc | Nội dung | Xong khi |
|---|---|---|
| **M0 Khởi tạo** | Bạn tạo tài khoản Supabase + Cloudflare (mình hướng dẫn từng bước); repo, CI, deploy trang trống | Mở được `*.pages.dev` |
| **M1 Nền tảng** | Đăng nhập, tạo gia phả, thêm/sửa Người và quan hệ, Cây, danh sách theo đời, tìm kiếm, Người chưa nối, phát hiện xung đột khi sửa | Nhập tay được một gia phả 3 đời và xem Cây |
| **M2 Excel** | File mẫu, nhập có xem trước + báo lỗi từng dòng, xuất Excel | Nhập 800 người từ một file trong < 1 phút, xuất ra rồi nhập lại không lệch dữ liệu |
| **M3 Chia sẻ** | Mời vai trò, link công khai, lọc thông tin riêng tư | Test chứng minh link công khai không trả về trường riêng tư |
| **M4 Lịch & nhắc** | Gói lịch âm + test, trang lịch, giỗ/sinh nhật/sự kiện, Danh sách nhắc giỗ, thông báo in-app, cron, bản tin email | Giỗ âm của năm 2026–2030 khớp lịch vạn niên; bản tin email nhận được lúc 7 giờ sáng |
| **M5 Phả đồ** | Bố cục in, chọn phạm vi, khổ giấy, mẫu khung, PDF + PNG | Phả đồ 800 người xuất PDF A0 rõ nét, chữ không dưới mức đọc được |
| **M6 Ảnh & hoàn thiện** | Ảnh tư liệu R2, nén ảnh, link mộ, giao diện truyền thống cho Cây/trang công khai, kiểm tra trên điện thoại | Toàn bộ chạy trong giới hạn free |

## 7. Rủi ro và cách xử lý

| Rủi ro | Xử lý |
|---|---|
| Supabase tạm dừng sau 7 ngày không có request | Cron hằng ngày gọi API |
| Email vượt 100/ngày khi nhiều dòng họ dùng | Gom bản tin; khi gần ngưỡng thì ưu tiên giỗ, nâng Resend Pro ($20) nếu cần |
| Lỡ tay xoá mất một nhánh (không có thùng rác ở v1) | Xoá Người có con cháu phải gõ xác nhận; khuyến khích xuất Excel định kỳ làm bản sao lưu |
| Cây 800+ người vẽ chậm | Chỉ vẽ phần nhìn thấy, mặc định thu gọn từ đời 5 |
| Tính sai ngày âm làm mất uy tín | Bộ test đối chiếu lịch vạn niên nhiều năm, gồm năm nhuận |
| Giới hạn kích thước canvas của trình duyệt khi xuất PNG khổ lớn | Tự hạ dpi và báo trước; PDF vector là định dạng chính |
