## Problem Statement

Gia phả của nhiều dòng họ Việt chỉ còn một cuốn sổ giấy do trưởng họ giữ, hoặc vài file Excel/Word rời rạc. Con cháu ở xa không xem được, không ai cập nhật chung, ngày giỗ tính theo âm lịch nên mỗi năm rơi vào một ngày dương khác và dễ quên. Khi muốn in phả đồ treo nhà thờ họ phải nhờ thợ vẽ tay. Các công cụ hiện có (như Phả Tuệ) không cho chia sẻ bằng link công khai và không nhắc giỗ trên bản web.

## Solution

Một webapp miễn phí, nhiều dòng họ cùng dùng. Mỗi tài khoản tạo hoặc được mời vào các Gia phả. Trong mỗi Gia phả:
- Lưu đầy đủ thông tin Người qua mọi Đời, quan hệ tổng quát (nhiều hôn phối, con nuôi, thứ tự con, Cháu ngoại).
- Xem Cây tương tác, nhập/xuất Excel.
- Chia sẻ hai lớp: Vai trò (bản đầy đủ) và Link chia sẻ công khai (bản rút gọn, ẩn Thông tin riêng tư của người còn sống).
- Lịch âm dương, Ngày giỗ hiển thị theo âm và tự tính ra ngày dương mỗi năm; Nhắc nhở trong app và Bản tin nhắc qua email; sinh nhật nhắc trong app.
- Xuất Phả đồ chất lượng in (PDF vector, PNG).

Thuật ngữ theo `CONTEXT.md`. Quyết định nền tảng theo ADR 0001–0004.

## User Stories

**Tài khoản & Gia phả**
1. As a visitor, I want to sign up with email/password, so that I can start a Gia phả without SMS fees.
2. As an account, I want to create a Gia phả with a name and description, so that my dòng họ has its own space.
3. As an account, I want to see all Gia phả I own or was invited to, so that I can switch between them.
4. As an account, I want a clear message when I reach the limit of 3 Gia phả, so that I understand why I can't create more.
5. As a Chủ sở hữu, I want to rename or delete my Gia phả (typing its name to confirm), so that I control its lifecycle.

**Người & quan hệ**
6. As a Biên tập viên, I want to add a Người as con of an existing Người, so that the tree grows downward.
7. As a Biên tập viên, I want to add cha/mẹ to an existing Người, so that the tree grows upward toward Thuỷ tổ.
8. As a Biên tập viên, I want to add vợ/chồng with a Thứ tự hôn phối (vợ cả, vợ hai…), so that polygamous or remarried ancestors are recorded correctly.
9. As a Biên tập viên, I want to mark a union as ly hôn or goá, so that the record reflects reality.
10. As a Biên tập viên, I want to mark a parent link as ruột or nuôi, so that con nuôi are recorded honestly.
11. As a Biên tập viên, I want to set Thứ tự con, so that trưởng/thứ order is shown correctly.
12. As a Biên tập viên, I want a Người's Đời and Chi computed automatically, so that I never maintain them by hand.
13. As a Biên tập viên, I want to record họ tên, tên thường gọi, tên huý, tên tự/hiệu, tên chữ Hán, giới tính, so that every naming tradition is preserved.
14. As a Biên tập viên, I want to record ngày sinh as a Ngày không đầy đủ (năm / tháng-năm / đủ, with "khoảng"), in âm or dương, so that incomplete old records can still be entered.
15. As a Biên tập viên, I want a full date entered in one calendar to be converted to the other automatically, so that both are always available.
16. As a Biên tập viên, I want to record quê quán, nơi ở, nghề nghiệp, học vấn, chức vụ/danh hiệu, SĐT, email, tiểu sử, so that the Gia phả keeps the person, not just the name.
17. As a Biên tập viên, I want to mark a Người as đã mất and record ngày mất (âm or dương, possibly incomplete), so that Ngày giỗ can be derived.
18. As a Biên tập viên, I want Ngày giỗ derived from ngày mất âm and editable by hand, so that families with a different tradition can override it.
19. As a Biên tập viên, I want hưởng thọ computed automatically, so that I don't calculate it.
20. As a Biên tập viên, I want to record Mộ phần (description + Google Maps link), nơi thờ and người phụ trách cúng giỗ, so that descendants can find the grave and know who hosts the giỗ.
21. As a Biên tập viên, I want to add a ghi chú vai vế (e.g. "trưởng chi 2"), so that roles in the họ are visible.
22. As a Biên tập viên, I want to add a Người whose cha/mẹ is unknown, so that gaps in records don't block data entry.
23. As a Biên tập viên, I want a "Chưa nối vào cây" list, so that I can connect Người chưa nối later.
24. As a Biên tập viên, I want to delete a Người, and to type a confirmation when that Người has descendants, so that I don't wipe a branch by accident.
25. As a Biên tập viên, I want to be told when someone else saved the same Người after I opened it, and see the differences, so that I never silently overwrite their work.
26. As a Biên tập viên, I want a clear message when a Gia phả reaches 2,000 Người, so that I know the limit.

**Xem Cây & tìm kiếm**
27. As a Người xem, I want to view the Cây top-down with pan and zoom, so that I can browse many Đời.
28. As a Người xem, I want to switch the Cây to left-to-right, so that it is easier to scroll on a phone.
29. As a Người xem, I want the first 4 Đời expanded and deeper branches collapsible, so that 800 people stay readable.
30. As a Người xem, I want spouses shown as adjacent boxes ordered by Thứ tự hôn phối, so that multiple marriages are clear.
31. As a Người xem, I want to toggle "chỉ đinh" vs "hiện Cháu ngoại N đời", so that the view matches my họ's tradition.
32. As a Người xem, I want to search by name (with or without dấu) and jump to that Người in the Cây, so that I find anyone quickly.
33. As a Người xem, I want a list grouped by Đời with counts of nam/nữ, so that I can review the Gia phả as a table.
34. As a Người xem, I want a Người's detail page with relatives as links, so that I can navigate family relationships.
35. As a Người xem, I want a "Chỉ đường" button on Mộ phần, so that I can open directions on my phone.

**Nhập/xuất Excel**
36. As a Chủ sở hữu, I want to download an Excel template where relationships are linked by mã số, so that I can prepare existing records offline.
37. As a Chủ sở hữu, I want to upload the filled file and see a preview (total Người, Đời, each person's relationships) before saving, so that mistakes are caught first.
38. As a Chủ sở hữu, I want row-level errors (missing mã, unknown cha, duplicated mã, invalid date) in the preview, so that I can fix the file.
39. As a Chủ sở hữu, I want import to create a new Gia phả or add into an empty one, so that I don't corrupt existing data.
40. As a Biên tập viên, I want to export the whole Gia phả to Excel in the same format, so that I have a backup and can bulk-edit offline.
41. As a Chủ sở hữu, I want export → import to reproduce the same Gia phả, so that the backup is trustworthy.

**Chia sẻ & quyền**
42. As a Chủ sở hữu, I want to invite an account by email as Biên tập viên or Người xem, so that relatives can help or follow.
43. As a Chủ sở hữu, I want to change or remove a Vai trò, so that access stays correct over time.
44. As a Biên tập viên, I want to invite and manage roles except the Chủ sở hữu's, so that each Chi can onboard its own people.
45. As an account, I want to link my account to the Người who is me in each Gia phả, so that defaults (like Danh sách nhắc giỗ) are personalised.
46. As a Chủ sở hữu, I want to turn the Link chia sẻ công khai on/off and regenerate it, so that I control who has it.
47. As a visitor with the link, I want to see the Cây without logging in, so that elderly relatives can open it from Zalo.
48. As a Người còn sống, I want my ngày-tháng sinh, SĐT, email, địa chỉ, tiểu sử, ảnh (including ảnh đại diện) and Mộ phần hidden on the public link, so that my privacy is protected.
49. As a Biên tập viên, I want a per-Người switch "ẩn hoàn toàn khỏi link công khai", so that anyone who asks can be removed from the public view.
50. As a visitor without a role, I want to be refused access to the full Gia phả, so that the dòng họ's data stays private.
51. As a sharer, I want the public link to show a proper title and preview image when pasted into Zalo/Facebook, so that it looks trustworthy.

**Lịch & sự kiện**
52. As an account, I want a month calendar showing dương days large and âm days small, with mùng 1 and rằm highlighted, so that I can read both calendars at a glance.
53. As an account, I want to tap a day and see can chi of ngày/tháng/năm, tiết khí, giờ hoàng đạo and that day's events, so that I can plan rituals.
54. As an account, I want Vietnamese holidays (Tết, rằm tháng Giêng, Thanh minh, Vu lan, Giỗ Tổ Hùng Vương, 2/9…) on the calendar, so that I see them alongside family events.
55. As an account, I want dots for giỗ, sinh nhật and Sự kiện from all my Gia phả, so that one calendar covers everything.
56. As a visitor, I want a public calendar page without login, so that anyone can look up âm/dương dates.
57. As a Biên tập viên, I want to create a Sự kiện (họp họ, custom) in âm or dương, one-off or yearly, so that the họ's schedule is shared.
58. As an account, I want Ngày giỗ displayed as âm date and its dương date for this year, so that I know both.
59. As an account, I want a giỗ of someone who died in a Tháng nhuận to fall on the regular month of the same number, so that it follows common practice.
60. As an account, I want a giỗ on day 30 to fall on the last day of the month in years where that month has 29 days, so that no year is skipped.

**Nhắc nhở**
61. As an account, I want a Danh sách nhắc giỗ pre-filled with my direct ancestors (about 4 Đời) from my linked Người, so that I'm not spammed with hundreds of giỗ.
62. As an account, I want to add/remove Người from my Danh sách nhắc giỗ, so that I follow the giỗ I care about.
63. As an account, I want to choose when to be reminded (đúng ngày, trước 1 / 3 / 7 ngày, and optionally Tiên thường), so that I have time to travel home.
64. As an account, I want in-app notifications with an unread badge, so that I see reminders when I open the app.
65. As an account, I want one Bản tin nhắc email per day at about 7:00 (giờ VN) listing everything due, so that my inbox isn't flooded.
66. As an account, I want to turn email off per Gia phả, so that I control my inbox.
67. As an account, I want in-app sinh nhật reminders only for Người còn sống, so that I congratulate relatives on time.

**Phả đồ**
68. As a Biên tập viên, I want to choose the print scope (whole Gia phả, one Chi, or from one Người down N Đời), so that I can print per Chi.
69. As a Biên tập viên, I want paper size presets A3–A0 or custom cm, portrait/landscape, so that it matches the print shop.
70. As a Biên tập viên, I want to choose box content (tên, năm sinh–mất, ảnh on/off, 1–2 extra lines like Ngày giỗ or Đời), so that the Phả đồ shows what my họ values.
71. As a Biên tập viên, I want 2–3 traditional frame templates, a title, a subtitle and câu đối text, so that it suits a nhà thờ họ.
72. As a Biên tập viên, I want a warning when text would be too small to read at the chosen size, with a suggestion (larger paper or split by Chi), so that prints are legible.
73. As a Biên tập viên, I want to export PDF vector at any size, so that the print shop gets sharp output.
74. As a Biên tập viên, I want to export PNG at 300 dpi up to A1 (lower automatically for A0, with notice), so that I can share an image.
75. As a Biên tập viên, I want my Phả đồ settings saved per Gia phả, so that I can reprint later without redoing them.
76. As a Biên tập viên, I want Người chưa nối excluded from the Phả đồ, so that the print shows only the connected tree.

**Ảnh**
77. As a Biên tập viên, I want to upload up to 5 photos per Người with captions and pick one as ảnh đại diện, so that faces are preserved.
78. As a Biên tập viên, I want photos compressed automatically (≤ 1,600 px, < 400 KB), so that free storage lasts.

**Giao diện**
79. As an elderly user, I want large text and large tap targets, so that I can use the app comfortably.
80. As a user, I want a traditional look on the Cây, Phả đồ and public page, and a clean modern look for data management, so that it feels respectful yet practical.

## Implementation Decisions

**Stack (ADR 0004):** React + TypeScript SPA (Vite) on Cloudflare Pages; Supabase Postgres + Auth (email/password); Cloudflare R2 for photos via signed upload URLs; Cloudflare Worker Cron weekly, Monday 00:00 UTC; Resend for email. Everything on free tiers. Starts on `*.pages.dev`; email enabled once a domain exists.

**Deep modules (each with a small interface, hiding complexity):**
- **Lịch âm module** (pure TS, shared by web and Worker): convert dương ↔ âm (timezone +7), can chi, tiết khí, giờ hoàng đạo, holiday list, and `giỗ occurrence in year X` for a lunar day/month with the Tháng nhuận and day-30 rules. Ngày không đầy đủ is a value type here (precision: year / month-year / full; calendar: âm / dương; approximate flag).
- **Tree layout module** (pure TS): input = Người, parent links, unions, display options (orientation, chỉ đinh / Cháu ngoại N Đời, collapsed nodes, scope root + depth); output = positioned boxes and connectors, plus overall size. Used by both the interactive Cây and the Phả đồ.
- **Phả đồ renderer**: takes layout + print options (paper, frame, title, câu đối, box content) → SVG; SVG → PDF (vector, embedded Vietnamese font) and PNG (canvas, dpi capped by browser limits). Returns legibility warnings.
- **Excel module** (pure TS over SheetJS): parse template → preview model with row errors; serialize Gia phả → template. Same format both ways.
- **Gia phả data access**: a thin typed client over Supabase used by the UI and by tests; all authorization lives in the database.
- **Reminder engine**: given a date, compute due Nhắc nhở per account from Ngày giỗ (derived), sinh nhật (derived, còn sống only), Sự kiện, Danh sách nhắc giỗ and reminder preferences; write in-app notifications and build one Bản tin nhắc per account. Runs in the Worker; also keeps Supabase active.

**Schema (Postgres):** `family_trees` (name, owner, public share token nullable, display settings), `tree_roles` (account, tree, role owner/editor/viewer, linked person), `persons` (all fields in stories 13–21; incomplete dates stored as value + precision + calendar + approximate; hide_from_public; `version` integer), `parent_links` (child, parent, kind ruột/nuôi), `unions` (two persons, order for each side, status), `photos` (person, R2 key, caption, is_avatar), `events` (tree, kind, date + calendar, yearly), `reminder_watch` (account, person), `reminder_prefs` (account, tree, offsets, email on/off), `notifications` (account, payload, due date, read_at), `chart_layouts` (tree, saved print options). Giỗ and sinh nhật are derived from `persons`, not duplicated into `events`.

**Authorization:** Row Level Security on every table keyed by (account, tree) via `tree_roles`. Only owner/editor can write; editors cannot modify the owner's role. Limits (3 trees/account, 2,000 persons/tree, 5 photos/person) enforced in the database, values configurable.

**Public link:** a security-definer SQL function takes the share token and returns only allowed fields: for living persons name, Đời, relationships, birth year; excludes hidden persons; never returns photos or Mộ phần for living persons. A Pages Function serves the public page with Open Graph tags.

**Concurrent edits:** saving a Người sends its `version`; if it no longer matches, the save is rejected and the current row is returned so the UI can show the differences.

**Delete:** hard delete; deleting a Người with descendants requires typed confirmation in the UI. No history log or trash in v1.

**Milestones (from PLAN.md):** M0 setup → M1 nền tảng → M2 Excel → M3 chia sẻ → M4 lịch & nhắc → M5 phả đồ → M6 ảnh & hoàn thiện. Each milestone is deployed and usable.

## Testing Decisions

A good test exercises a module only through its public interface and asserts observable behaviour (dates, visible fields, positions, errors), never internal helpers or query shapes. Three seams, agreed with the user:

- **Seam A – Lịch âm module:** table-driven tests against a lịch vạn niên reference across many years, including leap-month years, months with 29 days, Tết boundaries, and giỗ occurrence for 2026–2030.
- **Seam B – Gia phả data, through the same Supabase client the web uses, against a local Postgres (Supabase CLI):** each test acts as Chủ sở hữu, Biên tập viên, Người xem, an unrelated account, and an anonymous public-link visitor. Covers RLS isolation between trees, role changes, public-link field filtering and hidden persons, version conflicts, limits, Excel import → export → import round trip, and the reminder engine for a fixed date (Danh sách nhắc giỗ, offsets, sinh nhật only for living persons, one Bản tin per account).
- **Seam C – Tree layout module:** property tests: no overlapping boxes, spouses adjacent in Thứ tự hôn phối order, children ordered by Thứ tự con, Người chưa nối absent, Cháu ngoại filter respects N, scope root + depth respected, legibility warning triggered at the right sizes.
- Plus 2–3 end-to-end smoke tests (sign in → create Gia phả → add Người → view Cây; open public link) to prove wiring, not UI details.

No prior art: the repo is greenfield; these tests set the pattern.

## Out of Scope

AI features (photo restoration, reading Word files, assistant); ngày tốt xấu / xem tuổi / tìm ngày tốt; Zalo, SMS, web push; native mobile apps; change history and trash; drag-and-drop editing of individual Phả đồ boxes, per-Đời colours, rồng chầu and image decorations; quỹ họ, tài sản, danh bạ, thắp hương ảo, Phả ký book; multi-language UI; embedded maps (Mộ phần is a link only); paid tiers or billing.

## Further Notes

- Free-tier limits that shape design: Supabase 500 MB DB and 7-day inactivity pause; R2 10 GB; Resend 100 emails/day; Workers short CPU per request (so PDF/PNG generation runs in the browser).
- A domain (~250–300k VND/year) is the only expected cost, needed for reliable email.
- Glossary: `CONTEXT.md`. Decisions: `docs/adr/0001`–`0004`. Plan and milestone acceptance criteria: `PLAN.md` (also in the "Family tree" Project).

## Updates after the first version

The stories above are the original scope; the product has since moved on in these ways (the code, `CONTEXT.md` and `supabase/migrations` are the source of truth):

- **Accounts (story 1):** sign-up is gated by manual approval (`account_approvals`); an unapproved account can use nothing, even if invited.
- **Roles (stories 42–44, 46–47):** only the Chủ sở hữu invites and manages roles. A Biên tập viên edits and deletes only the Người they created; deleting is a request the Chủ sở hữu approves. The public link requires a password (the preview card shows only name and head-count).
- **Photos (stories 5, 77, 78):** up to 3 per Người (not 5), stored on Google Drive through the `/api/photos` Pages Function (not R2); the browser scales to 1000 px / 1600 px and lowers JPEG quality until each file is under 400 KB (hard server cap 4 MB). A Gia phả has its own cover photo.
- **Public link (story 49):** a Người hidden from the link who has children in the tree appears as an anonymous "Ẩn danh" box so descendants stay connected; hidden with no children is dropped entirely.
- **Public link brute force:** 10 wrong passwords in 10 minutes lock the link for the rest of that window (`TOO_MANY_ATTEMPTS`), per Gia phả; the Chủ sở hữu still sees the tree through their account.
- **Deleting a Gia phả / photos:** the Pages Function deletes the database row first (owner's rights, RLS decides) and only then the Drive folder. "Dọn ảnh mồ côi" (owner) removes Drive files no row points to (left by failed file deletes or by photos beyond the per-Người limit when merging duplicates).
- **Sự kiện (story 57):** Biên tập viên chỉ sửa/xoá Sự kiện do chính mình tạo (như Người); Chủ sở hữu mọi Sự kiện. Bảng quy tắc ghi đầy đủ ở `CONTEXT.md`, kiểm bằng `tests/db/write-rules.test.ts`.
- **Email nhắc (story 65):** người nhận do hàm SQL `digest_recipients()` quyết định; Worker gửi có thử lại (429/5xx), khoá idempotency theo gia phả + ngày, một gia phả lỗi không chặn gia phả khác, và lần chạy báo thất bại nếu còn gia phả không gửi được.
- **Names (story 13):** tên chữ Hán is still stored and in the Excel file but is not shown in the profile form. Tên huý is back in the form and profile, and the baby-name check ("Tra cứu trùng tên") also avoids ancestors' tên huý.
- **Giỗ (story 18):** the auto-derived giỗ is the day before the death date (see `CONTEXT.md`).
- **Reminders (stories 61–67):** giỗ reminders default ON for everyone; `reminder_watch` now lists the Người an account has *muted*. The email digest (story 65) is one email per Gia phả to its Chủ sở hữu and Biên tập viên, sent every 5 days (cron runs daily, sends when the Julian day divides by 5), covering giỗ, sinh nhật, kỷ niệm cưới and Sự kiện of the next 5 days. Because it is shared, it ignores per-account mutes and "độ sớm nhắc"; those apply to the in-app bell. The optional "tiên thường" reminder (story 63) is a per-Gia-phả switch on the in-app bell (`reminder_prefs.tien_thuong`); the email already lists each giỗ a few days ahead, so it does not add a separate tiên thường entry.
- **Excel (stories 36–41):** export/import also carries union status, ngày cưới, người phụ trách cúng giỗ (by mã), "ẩn khỏi link công khai" and "lập chi mới".
- **Added since:** Phả ký (page + PDF), Tra cứu quan hệ, Hồ sơ thiếu, Dòng thời gian, thống kê vui, Gộp người trùng, Kỷ niệm cưới and "Ngày này năm xưa", subscribable calendar (`/api/calendar/<token>.ics`), full backup `.zip`, PWA with offline read, 7 Phả đồ frame styles with font/scale options.
- **Schema notes:** in-app reminders are derived in the browser (no `notifications` table; `notification_reads` records what was read); the saved print settings live in `pha_do_configs` (no `chart_layouts`).
