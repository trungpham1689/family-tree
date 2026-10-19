-- Nhắc giỗ đổi sang mặc định BẬT cho mọi Người (trước đây phải tự thêm vào Danh sách mới được nhắc).
-- Bảng reminder_watch giữ nguyên cấu trúc, chỉ đổi ý nghĩa: từ "danh sách được nhắc" (opt-in) sang
-- "danh sách đã tắt nhắc" (opt-out). Dữ liệu cũ (ai đang được nhắc) không map được sang nghĩa mới
-- nên xoá sạch — sau migration này không ai bị tắt nhắc giỗ cho tới khi tự tắt.
truncate table public.reminder_watch;

comment on table public.reminder_watch is
  'Người đã TẮT nhắc giỗ (opt-out). Mặc định mọi Người đều được nhắc giỗ; có mặt trong bảng này nghĩa là tài khoản đã tắt riêng Người đó.';
