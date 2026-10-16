# 0001 — Hỗ trợ nhiều gia phả ngay từ đầu

**Trạng thái:** Đã chấp nhận · 2026-10-16

## Bối cảnh
Webapp dành cho nhiều dòng họ: ai cũng có thể đăng ký và tạo gia phả riêng, mời người thân vào.

## Quyết định
Mọi dữ liệu (Người, quan hệ, sự kiện, ảnh, phả đồ, vai trò) đều thuộc về đúng một Gia phả. Quyền truy cập luôn kiểm tra theo cặp (tài khoản, gia phả), bắt buộc ở tầng database (row-level security), không chỉ ở giao diện.

## Hệ quả
- Không thể có rò rỉ dữ liệu giữa các dòng họ nếu policy đúng; cần test policy kỹ.
- Hạ tầng miễn phí bị chia sẻ giữa các dòng họ, nên cần giới hạn mỗi tài khoản (số gia phả, số ảnh).
