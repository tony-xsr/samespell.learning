# SameSpell Learning

Web app học từ vựng Trung / Hàn / Nhật qua **nhóm đồng âm dị nghĩa** — nhiều chữ Hán/Hanja
đọc giống nhau nhưng nghĩa khác nhau. Ý tưởng gốc và bối cảnh: xem [docs/PROJECT_IDEA.md](docs/PROJECT_IDEA.md).

Ảnh mindmap tham khảo nằm trong [ideas/](ideas/).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Đăng nhập bắt buộc: 1 tài khoản học (`USER_NAME`/`PASSWORD`) + 1 tài khoản quản trị
  (`ADMIN_USER_NAME`/`ADMIN_PASSWORD`), session cookie ký bằng `SESSION_SECRET`
  (`src/middleware.ts`, `src/lib/session.ts`)
- Dữ liệu từ vựng: file JSON tĩnh trong [data/](data/) + phần AI sinh thêm lưu trong
  Upstash Redis (`src/lib/vocabStore.ts`) — mọi người dùng chung thấy cùng dữ liệu
- Tiến trình học (SRS): lưu server-side trong Upstash Redis qua `/api/progress`
  (`src/lib/progressStore.ts`) thay vì `localStorage`, vì giờ có đăng nhập
- AI sinh từ vựng / mindmap / ví dụ / ghi chú ngữ pháp: hỗ trợ đa nhà cung cấp —
  Anthropic, Groq, Google Gemini, OpenAI (`src/lib/ai/`), chọn provider + nhập key
  qua trang `/admin`
- Trang `/admin`: cấu hình AI provider, và nút "Mở rộng từ vựng thủ công" (dò các chữ
  gốc ít từ, nhờ AI sinh thêm, tránh trùng lặp) — nền tảng để bật cronjob tự động sau này
- Sao lưu/khôi phục: trang `/admin` có nút xuất toàn bộ tiến trình học + từ vựng AI sinh thêm +
  mẹo nhớ ra 1 file JSON (`src/lib/backup.ts`, `/api/admin/backup`), và nút khôi phục lại từ file
  đó — phòng khi tài khoản Upstash Redis bị mất quyền truy cập, chỉ cần tạo database mới rồi
  khôi phục là có lại dữ liệu (không gồm API key AI, cần nhập lại thủ công)

## Getting Started

Cần tạo 1 database Redis miễn phí tại [upstash.com](https://upstash.com) trước (dùng để lưu
tiến trình học, từ vựng AI sinh thêm, và cấu hình AI provider).

```bash
npm install
cp .env.example .env.local
# điền: USER_NAME/PASSWORD, ADMIN_USER_NAME/ADMIN_PASSWORD, SESSION_SECRET (chuỗi ngẫu nhiên),
# UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN, và ít nhất 1 API key AI (Anthropic/Groq/Gemini/OpenAI)
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) → đăng nhập bằng `USER_NAME`/`PASSWORD`.
Vào `/admin` (đăng nhập riêng bằng `ADMIN_USER_NAME`/`ADMIN_PASSWORD`) để chọn AI provider,
nhập key, và chạy mở rộng từ vựng thủ công.

## Cấu trúc dữ liệu

Mỗi ngôn ngữ (`data/zh.json`, `data/ko.json`, ...) chứa danh sách **nhóm âm** (`SoundGroup`):
một cách đọc chung (vd "mù", "목") ánh xạ tới nhiều **chữ gốc** (`RootEntry`) khác nghĩa,
mỗi chữ gốc có danh sách **từ ghép** (`VocabWord`) kèm ví dụ và có thể kèm 1 ghi chú ngữ pháp
(`grammarPoint`/`grammarExplanationVn`, chủ yếu dùng cho tiếng Hàn/Nhật). Xem định nghĩa đầy đủ ở
[src/types/vocab.ts](src/types/vocab.ts). Dữ liệu AI sinh thêm được merge vào dữ liệu tĩnh ở
tầng server (`src/lib/vocabStore.ts`) trước khi trả về trang.

## Bật cronjob tự động (chưa bật sẵn)

`src/lib/ai/expandBatch.ts` là logic dùng chung cho cả nút bấm thủ công trong `/admin` lẫn
cronjob tự động sau này. Để bật tự động trên Vercel: thêm `vercel.json` với mục `crons` gọi
`POST /api/admin/expand-batch` theo lịch, kèm cơ chế xác thực riêng cho request từ cron
(vd. header bí mật) vì middleware hiện chỉ chấp nhận session cookie của admin.

## Deploy

Deploy lên [Vercel](https://vercel.com/new) — thêm toàn bộ biến môi trường trong `.env.example`
vào phần Environment Variables của project trên Vercel.

## Đề xuất tính năng (chưa làm — cân nhắc thêm)

Danh sách ý tưởng để tham khảo, chưa triển khai:

- **Bật cronjob thật trên Vercel**: đã có `vercel.json` mẫu + `expandBatch.ts` dùng chung, chỉ
  cần thêm header bí mật xác thực request từ cron (middleware hiện chỉ nhận session cookie admin).
- **Dashboard tiến trình học**: tổng số từ đã học, số từ due hôm nay, streak ngày học liên tục.
- **Xuất flashcard sang Anki** (`.apkg`/`.csv`) để học trên app Anki quen thuộc.
- **Tìm kiếm từ vựng toàn app** thay vì chỉ duyệt theo từng nhóm âm.
- **Chế độ nghe-đoán (dictation)**: TTS đọc từ, người học gõ lại nghĩa/phiên âm trước khi xem đáp án.
- **Bộ ôn "từ khó"** tự động gom các từ có tỷ lệ trả lời sai cao vào một bộ ôn tập riêng.
- **PWA / offline**: cài như app trên điện thoại, học được cả khi mất mạng (dữ liệu tĩnh cache sẵn).
- **Xuất ảnh mindmap** (PNG) để lưu/note riêng hoặc chia sẻ.
- **Đa dạng kiểu câu hỏi ôn tập**: trắc nghiệm chọn nghĩa đúng, nghe chọn từ, ghép từ-nghĩa — không
  chỉ lật thẻ như hiện tại.
- **Multi-user thật**: hiện chỉ 1 tài khoản học + 1 admin qua env var; nếu sau này có nhiều người
  học cùng lúc (mỗi người tiến trình riêng), cần đổi sang bảng user thật thay vì 1 cặp cố định.
