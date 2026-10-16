# 0002 — Chia sẻ hai lớp: link công khai rút gọn + vai trò đầy đủ

**Trạng thái:** Đã chấp nhận · 2026-10-16

## Bối cảnh
Cần chia sẻ online dễ (người lớn tuổi mở link Zalo là xem) nhưng không lộ thông tin của người còn sống. Phả Tuệ chọn cách chỉ cho tài khoản được mời xem, không có link công khai.

## Quyết định
- **Link chia sẻ công khai** (bật/tắt, tạo lại được): xem cây với tên, đời, năm sinh/mất, ảnh của người đã mất. Ẩn *Thông tin riêng tư* của người còn sống.
- **Vai trò** (Chủ sở hữu / Biên tập viên / Người xem): đăng nhập, thấy bản đầy đủ.
- Bản công khai được tạo ra từ dữ liệu đã lọc ở phía server, không gửi dữ liệu đầy đủ rồi ẩn trên giao diện.

## Hệ quả
- Danh sách trường "riêng tư" phải được định nghĩa rõ và có test.
- Tạo lại link làm link cũ mất hiệu lực.
