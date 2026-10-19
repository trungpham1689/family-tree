-- Nhắc "Tiên thường" (ngày trước Chính kỵ) tuỳ chọn, theo từng gia phả, cho chuông nhắc nhở trong app (SPEC story 63).
alter table public.reminder_prefs add column tien_thuong boolean not null default false;
