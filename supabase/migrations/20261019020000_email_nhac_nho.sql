-- Bật/tắt bản tin email nhắc nhở theo từng Gia phả (SPEC story 66). Worker Cron đọc cột này
-- bằng service_role (bỏ qua RLS) nên không cần policy riêng ngoài policy cập nhật đã có.
alter table public.reminder_prefs add column email_enabled boolean not null default true;
