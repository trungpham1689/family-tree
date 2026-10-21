# 0004 — Hạ tầng hoàn toàn miễn phí

**Trạng thái:** Đã chấp nhận · 2026-10-16. Giai đoạn đầu chạy trên `*.pages.dev`; email bật khi có tên miền.

## Bối cảnh
Ràng buộc: chỉ dùng gói miễn phí. Nhiều dòng họ, mỗi họ 500–800 người, có ảnh, nhắc giỗ qua email.

## Quyết định
| Thành phần | Dịch vụ | Giới hạn free đáng chú ý |
|---|---|---|
| Database + đăng nhập | Supabase Free | 500 MB DB, 50k MAU, **tạm dừng sau 7 ngày không có request** |
| Ảnh | Google Drive của chủ app, qua Pages Function `/api/photos` | 15 GB; ảnh nén còn 100–300KB nên đủ cho hàng chục nghìn ảnh |
| Hosting web | Cloudflare Pages | Băng thông không giới hạn |
| Việc chạy hằng ngày (nhắc giỗ) | Cloudflare Worker Cron | 100k request/ngày, CPU ngắn |
| Email | Resend Free | 3.000/tháng, **100/ngày**, 1 domain |
| Xuất PDF/PNG phả đồ | Chạy trong trình duyệt | Không tốn server |

Lý do không dùng Supabase Storage cho ảnh: chỉ 1 GB; một dòng họ 800 người có ảnh đã có thể dùng hết. Chọn Google Drive thay R2 (2026-10-19): chủ app đã có sẵn Drive, không thêm dịch vụ; mỗi gia phả một thư mục để dễ sao lưu thủ công.

## Hệ quả
- Cron hằng ngày gọi API Supabase, vừa gửi nhắc vừa giữ project không bị tạm dừng.
- Email gom thành **một bản tin/ngày cho mỗi tài khoản** để không vượt 100 email/ngày; thông báo trong app không giới hạn.
- Khi vượt giới hạn: Supabase Pro ($25/tháng) và Resend Pro ($20/tháng) là bước nâng cấp, không phải viết lại.
- Cần có tên miền riêng để gửi email qua Resend (khoảng 250–300 nghìn đồng/năm, phần duy nhất có thể tốn tiền).

## Cập nhật 2026-10-20 (app mobile và đăng ký trả phí)
Ràng buộc "hạ tầng hoàn toàn miễn phí" **vẫn giữ cho tới khi có khoảng 50 tài khoản trả phí** ([ADR 0006](0006-dang-ky-theo-tai-khoan-chu-so-huu.md)); khi đó mới nâng Supabase/Resend Pro. Các khoản chi mới đã chấp nhận cho app mobile ([ADR 0007](0007-hai-ung-dung-web-va-mobile.md)): Apple Developer $99/năm, Google Play $25 một lần, tên miền riêng (cần sớm hơn, để deep link và URL chính sách quyền riêng tư cho store). Cron hằng ngày thêm việc gửi push qua Expo Push (miễn phí).

## Cập nhật 2026-10-21 (email chuyển từ Resend sang Brevo)
Email gửi qua **Brevo Free** (300/ngày) thay Resend: Brevo cho xác minh một địa chỉ người gửi riêng lẻ nên chưa cần tên miền riêng (Resend chỉ cho gửi tới chủ tài khoản khi chưa có domain). Đánh đổi: Brevo thay địa chỉ người gửi bằng địa chỉ của Brevo khi không xác thực domain, mail dễ vào Spam; API Brevo không có khoá idempotency nên gửi lại sau lỗi mạng có thể gửi đôi. Biến môi trường: `BREVO_API_KEY`, `BREVO_FROM` (Worker và Pages Function `/api/invite-email`).
