# 0004 — Hạ tầng hoàn toàn miễn phí

**Trạng thái:** Đã chấp nhận · 2026-10-16. Giai đoạn đầu chạy trên `*.pages.dev`; email bật khi có tên miền.

## Bối cảnh
Ràng buộc: chỉ dùng gói miễn phí. Nhiều dòng họ, mỗi họ 500–800 người, có ảnh, nhắc giỗ qua email.

## Quyết định
| Thành phần | Dịch vụ | Giới hạn free đáng chú ý |
|---|---|---|
| Database + đăng nhập | Supabase Free | 500 MB DB, 50k MAU, **tạm dừng sau 7 ngày không có request** |
| Ảnh | Cloudflare R2 | 10 GB, không tính phí băng thông |
| Hosting web | Cloudflare Pages | Băng thông không giới hạn |
| Việc chạy hằng ngày (nhắc giỗ) | Cloudflare Worker Cron | 100k request/ngày, CPU ngắn |
| Email | Resend Free | 3.000/tháng, **100/ngày**, 1 domain |
| Xuất PDF/PNG phả đồ | Chạy trong trình duyệt | Không tốn server |

Lý do không dùng Supabase Storage cho ảnh: chỉ 1 GB; một dòng họ 800 người có ảnh đã có thể dùng hết.

## Hệ quả
- Cron hằng ngày gọi API Supabase, vừa gửi nhắc vừa giữ project không bị tạm dừng.
- Email gom thành **một bản tin/ngày cho mỗi tài khoản** để không vượt 100 email/ngày; thông báo trong app không giới hạn.
- Khi vượt giới hạn: Supabase Pro ($25/tháng) và Resend Pro ($20/tháng) là bước nâng cấp, không phải viết lại.
- Cần có tên miền riêng để gửi email qua Resend (khoảng 250–300 nghìn đồng/năm, phần duy nhất có thể tốn tiền).
