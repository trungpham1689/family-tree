-- Cách hiển thị mặc định của Gia phả: chỉ đinh (0) hay hiện Cháu ngoại N đời (ADR 0003).
-- Chỉ là tuỳ chọn hiển thị, dữ liệu quan hệ luôn được lưu đầy đủ. Chủ sở hữu đặt, người xem đổi tạm được.
alter table public.family_trees
  add column outside_generations smallint not null default 1
    check (outside_generations between 0 and 5);

comment on column public.family_trees.outside_generations is
  'Số đời Cháu ngoại hiện mặc định trên Cây và Phả đồ; 0 = chỉ đinh.';
