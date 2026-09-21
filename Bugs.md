- khi deploy lên vercel và play learning tạo rất nhiều mindmap, nhưng không thể backup và sao lưu data về local ? vậy có thể trực tiếp merge và tải data/ về sau đó tự update local hoặc có cơ chế backup data chứ ,  ? lỡ đổi redis thì sao? ko lẽ cứ lấy data cũ /data ? mất hết thay đổi ?  - có thể có cơ chế merge dữ liệu ? nếu người dùng web page , update data, tôi dùng localhost , 2 dữ liệu này sẽ hơi khác, nhưng cơ bản merge sẽ ít conflict, có thể fix ?
  ✅ Đã xử lý: (1) `sync-to-data` (đã có sẵn) gộp dữ liệu Redis vào `data/*.json` khi chạy `next dev`
  cục bộ trỏ tới cùng Upstash Redis với bản deploy — đây chính là cơ chế "merge" giữa 2 phía.
  (2) Mới thêm: snapshot tự động — Vercel Cron gọi `/api/cron/backup-snapshot` mỗi ngày, lưu 1 bản
  chụp toàn bộ tiến trình + từ vựng AI sinh thêm + mẹo nhớ ngay trong Redis (giữ 14 ngày gần nhất,
  xem `src/lib/backupSnapshots.ts`), khôi phục qua nút trong trang Quản trị. Vẫn giữ nguyên cơ chế
  tải file backup thủ công (`AdminBackup`) để phòng khi đổi hẳn tài khoản Redis — snapshot trong
  Redis không giúp gì nếu mất quyền truy cập chính Redis đó.

-✨ Tạo mindmap mới từ 1 từ bất kỳ rõ ràng tôi nhập 3 từ này cùng lúc  峰，风 ，疯 cùng fēng nhưng khi bấm submit chỉ tạo ra fēng  峰  ? có cơ chế nào tự phát hiện các từ nhập vào cùng âm để gom vào 1 mindmap , hoặc từ nhập có cùng âm với dataa có sẵn có thể gom thêm nó vào cái có sẵn ? giống add thêm node vào mindmap ? giống hiện tại tôi có 2 nhóm đều cùng 1 âm fēng  tạo ra rất nhiều duplicate đồng âm ?
  ⚠️ Dữ liệu 疯 (đã mất do sự cố `git checkout` trước đây) đã được soạn tay lại và gộp vào đúng nhóm
  `group-7603630d-...` (fēng, cùng 峰/风) trong `data/zh.json` — 4 từ: 疯, 疯狂, 发疯, 疯子.
  Cơ chế gốc của bug (nút "Tạo mindmap mới" không tự phát hiện các từ nhập cùng âm để gộp) VẪN CHƯA
  được sửa trong code — đây mới chỉ là khôi phục phần dữ liệu bị mất, chưa phải fix tính năng.

<Kết quả cuối: 596 nhóm · ~6267 id · 3740 từ vựng (tăng từ 2184, +1556 từ) · 484/596 nhóm (81%) đã đạt ≥7 từ. 112 nhóm còn thiếu > tiếp tục nhé 

- lỗi ngẫu nhiên và không thể lật thẻ nếu brower or devices chưa cài language? ko thể vẫn lật thẻ được ?
  ✅ Đã kiểm chứng bằng Playwright (giả lập trình duyệt 0 giọng đọc khớp ngôn ngữ, đúng tình huống
  thực tế): thao tác lật thẻ trong `ReviewSession.tsx` (dùng chung cho `/review`, `/{lang}/review`,
  `/shapes/.../review`, `/false-friends/.../review`, `/initials/.../review`) **hoàn toàn độc lập**
  với trạng thái TTS — vẫn lật được bình thường dù banner "chưa có giọng đọc" đang hiện. Không tái
  hiện được lỗi "không lật được thẻ" qua test tự động.
  ⚠️ Tuy nhiên phát hiện 1 bug thật liên quan: banner cảnh báo TTS bị set 1 lần rồi **tồn tại dai
  dẳng qua nhiều thẻ sau đó** (không tự tắt khi chuyển sang thẻ mới/chấm điểm xong) — có thể đây là
  điều gây cảm giác "app bị treo/lỗi" dù chức năng lật thẻ vẫn hoạt động. Đã sửa: xoá cảnh báo khi
  chuyển thẻ (`handleRate`, `handleToggleMastered`), đã xác nhận lại bằng Playwright: banner biến
  mất đúng lúc sang thẻ kế tiếp. Đồng thời bọc try/catch quanh `speechSynthesis.cancel()/speak()`
  trong `src/lib/tts.ts` để phòng lỗi throw đồng bộ trên thiết bị lạ không làm rơi unhandled
  rejection. **Quan trọng**: phát hiện thêm case đọc "jouju" (成就) là từ tiếng NHẬT (じょうじゅ),
  không phải tiếng Trung — card trộn ngôn ngữ hiển thị đúng, không có badge ngôn ngữ trên từng thẻ
  nên dễ gây nhầm lẫn "sao đọc pinyin lạ vậy" — cân nhắc thêm cờ ngôn ngữ nhỏ trên mỗi thẻ ở
  `/review` (mode trộn tất cả ngôn ngữ) trong 1 round sau nếu người dùng thấy cần.
  🔴 **Phát hiện ngoài dự kiến, mức độ nghiêm trọng cao hơn cả 2 việc trên**: khi điều tra, phát hiện
  README/Vercel dashboard cho thấy **88 commit liên tục (17 ngày, 20/08 → 06/09) chưa từng deploy
  thành công lên production** — nguyên nhân là lỗi ESLint chặn build (`react/no-unescaped-entities`
  ở `antonym-chars/page.tsx`, dấu `"` chưa escape) khiến MỌI deploy từ đó đến giờ đều fail, Vercel
  âm thầm giữ nguyên bản build cũ (20/08) chạy production. Trong số 88 commit bị kẹt có cả: toàn bộ
  tính năng Test/Quiz, personal lists (Từ vựng của tôi), rất nhiều round mở rộng mindmap cổ trang
  tiếng Trung/Anh, và 1 fix quan trọng khác cũng bị kẹt theo — `Language` type từng thiếu hẳn `"en"`
  nên `topicStore.ts` chưa từng import `en-topics.json`, nghĩa là **toàn bộ mindmap chủ đề tiếng Anh
  (bao gồm mảng cổ trang tiếng Anh) có thể chưa từng hiển thị được trên bản production thật** dù đã
  code xong từ lâu. Đã sửa lỗi escape (`7b558c8`) và code build sạch trở lại, nhưng **push bị chặn do
  Git credential hết hạn** (`Invalid username or token`) — cần tự đăng nhập lại Git rồi `git push
  origin main` để toàn bộ 88+ commit (gồm cả các fix trong mục này) được deploy.

