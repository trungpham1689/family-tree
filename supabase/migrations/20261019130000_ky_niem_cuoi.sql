-- Ngày cưới của một cuộc hôn phối (dương lịch), có thể chỉ biết năm hoặc năm + tháng.
-- Đủ ngày-tháng-năm thì mới có Kỷ niệm cưới hằng năm; chỉ có năm vẫn hiện trên Dòng thời gian.
alter table public.unions
  add column marriage_year smallint check (marriage_year between 1 and 2200),
  add column marriage_month smallint check (marriage_month between 1 and 12),
  add column marriage_day smallint check (marriage_day between 1 and 31),
  add constraint unions_marriage_complete check (
    (marriage_month is null or marriage_year is not null) and (marriage_day is null or marriage_month is not null)
  );
