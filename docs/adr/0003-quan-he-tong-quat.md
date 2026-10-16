# 0003 — Lưu quan hệ tổng quát, lọc khi hiển thị

**Trạng thái:** Đã chấp nhận · 2026-10-16

## Bối cảnh
Các dòng họ ghi phả khác nhau: có họ chỉ chép đinh nam, có họ ghi đủ con gái và cháu ngoại. Còn có nhiều vợ/chồng, con nuôi, thứ tự con.

## Quyết định
Lưu quan hệ dạng tổng quát: mỗi Người có cha, mẹ (ruột hoặc nuôi), danh sách hôn phối có thứ tự, và thứ tự con. Cách ghi "chỉ đinh" hay "có cháu ngoại N đời" là **tuỳ chọn hiển thị** của Cây và Phả đồ, không phải ràng buộc dữ liệu.

## Hệ quả
- Đổi cách hiển thị không cần sửa dữ liệu.
- Thuật toán vẽ cây phải xử lý được nhiều hôn phối và lọc nhánh.
