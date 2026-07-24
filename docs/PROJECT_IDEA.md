# Ý tưởng gốc (ghi chú của tác giả)

> Giữ nguyên nội dung gốc từ readme.md ban đầu, để tham chiếu khi thiết kế tính năng.

Dựa trên ý tưởng clone UI và tính năng UI từ `d:\devback\leanwithAI\learntools\extension`,
có thể dựng 1 mini web deploy lên Vercel để học từ vựng dựa trên ý tưởng đồng âm — từ giống nhau
nhưng nghĩa khác nhau — kèm ví dụ và từ vựng.

Trước mắt hỗ trợ tiếng Trung, tiếng Hàn và tiếng Nhật.

Thư mục `ideas/` có hình ảnh mindmap tham khảo, có thể hỗ trợ mở rộng từ vựng dựa trên từ vựng
có sẵn dựa vào AI.

Có thể học và ôn lại thẻ từ, coi lại mindmap, generate mindmap và cho ví dụ mỗi từ vựng.

Ý tưởng: tiếng Việt có mượn từ tiếng Trung, Hàn, Nhật, nên có rất nhiều từ có thể dễ hiểu đối với
người biết tiếng Trung trung cấp và người Việt bản ngữ.

Thiết kế thẻ học giống Anki và extension tham khảo ở trên.

Bổ sung thêm các tính năng khác tương tác với AI: prompt tạo thêm nhiều từ, hoặc generate mindmap...

Tập trung vào các từ đọc hơi giống hoặc giống nhau nhưng nghĩa khác nhau — vì học ~200 từ dạng
này có thể giúp hiểu được 400–600 từ khác.

Web đẹp, dễ sử dụng, đặc biệt thiết kế tốt trên màn hình điện thoại.

Database: chỉ dùng `.json`, không cần database khác. Dữ liệu user cũng vậy — `.json`.

---

## Quyết định thiết kế (từ phiên scaffold đầu tiên)

- **Stack**: Next.js (App Router) + TypeScript + Tailwind CSS, deploy trên Vercel.
- **AI provider**: Anthropic Claude, gọi qua API route phía server (`ANTHROPIC_API_KEY`).
- **Dữ liệu từ vựng** (`data/*.json`): tĩnh, bundle cùng app, đọc read-only lúc build/runtime —
  hợp lệ trên Vercel vì không cần ghi.
- **Tiến trình học (SRS state, bookmark, mastered...)**: lưu ở **`localStorage` của trình duyệt**
  dưới dạng JSON, KHÔNG ghi file JSON phía server. Lý do: Vercel serverless functions chạy trên
  filesystem ephemeral/read-only — ghi file server-side sẽ không tồn tại lâu dài và không share
  giữa các lần deploy/instance. `localStorage` giữ đúng tinh thần "chỉ cần json, không cần DB"
  mà vẫn hoạt động đúng trên hosting serverless. Có thể thêm nút "Export / Import JSON" để backup
  thủ công tiến trình học.

## Quyết định thiết kế (phiên 2 — thêm login, admin, đa AI provider)

> Các quyết định ở đây **thay thế** phần "Tiến trình học lưu localStorage" ở trên — không còn
> đúng nữa sau khi thêm yêu cầu đăng nhập.

- **Vẫn deploy Vercel**, không tự host, nên vẫn không ghi file JSON trực tiếp lên đĩa được.
  Thay vào đó dùng **Upstash Redis** (`src/lib/kv.ts`) làm nơi lưu JSON nhẹ, bền vững qua các lần
  invoke — đúng tinh thần "chỉ cần json, không cần DB nặng" nhưng vẫn sống sót trên serverless.
- **Đăng nhập bắt buộc mới được học và xem data**: 1 tài khoản user + 1 tài khoản admin, lấy từ
  biến môi trường (`USER_NAME`/`PASSWORD`, `ADMIN_USER_NAME`/`ADMIN_PASSWORD`), không phải hệ
  thống nhiều user — phù hợp quy mô cá nhân. Session là cookie tự ký bằng HMAC (`SESSION_SECRET`),
  kiểm tra ở `src/middleware.ts` (đặt trong `src/` chứ không phải root, vì project dùng cấu trúc
  `src/`).
- **Tiến trình học** chuyển từ `localStorage` sang Upstash Redis qua `/api/progress`, vì giờ có
  đăng nhập nên hợp lý để tiến trình theo tài khoản thay vì theo trình duyệt.
- **Từ vựng do AI sinh thêm** (nút "Thêm từ" / "Tìm chữ đồng âm" / cronjob) giờ lưu ở Upstash Redis
  phía server (`src/lib/vocabStore.ts`) thay vì `localStorage` của người bấm nút — để mọi người
  dùng chung thấy cùng dữ liệu, và để cronjob (không có trình duyệt) cũng ghi được.
- **Đa nhà cung cấp AI**: Anthropic, Groq, Gemini, OpenAI, trừu tượng hoá qua
  `src/lib/ai/generate.ts`. Groq dùng chung SDK `openai` vì Groq tương thích API OpenAI (chỉ đổi
  `baseURL`). Provider đang dùng + API key + model chọn qua trang `/admin`, lưu trong Redis; nếu
  chưa cấu hình qua admin thì fallback về biến môi trường (`ANTHROPIC_API_KEY`, `GROQ_API_KEY`,
  `GEMINI_API_KEY`, `OPENAI_API_KEY`).
- **Cronjob**: chưa bật lịch tự động — mới có logic dùng chung
  (`src/lib/ai/expandBatch.ts`) + nút bấm thủ công trong `/admin`. Lý do: tránh gọi AI tốn phí
  ngoài ý muốn trước khi kiểm soát được chất lượng/chi phí; bật lịch thật (Vercel Cron) là bước
  sau, chỉ cần thêm `vercel.json` + xác thực riêng cho request cron.
- **Ghi chú ngữ pháp**: mỗi `VocabWord` có thể có `grammarPoint`/`grammarExplanationVn` (optional),
  chủ yếu áp dụng cho tiếng Hàn/Nhật — AI được hướng dẫn qua prompt để điền khi câu ví dụ minh hoạ
  một điểm ngữ pháp đặc trưng, bỏ trống nếu không có gì đặc biệt hoặc là tiếng Trung.
