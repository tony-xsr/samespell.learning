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

**Nhóm hình chữ** (`data/zh-shape.json`, `data/ja-shape.json`): trục nhầm lẫn thứ hai, song song với
nhóm âm — gom các chữ Hán/Kanji **VIẾT gần giống nhau** (形近字, vd 未/末, 士/土, 己/已/巳) thay vì đọc
giống nhau. Dùng chung 100% kiểu `SoundGroup`/`RootEntry`/`VocabWord`, chỉ đánh dấu thêm
`groupKind: "shape"` để UI đổi nhãn ("Nhóm hình" thay vì "Nhóm âm") và ẩn nút AI "tìm chữ đồng âm mới"
(không có ý nghĩa với trục hình). Truy cập qua `/shapes` (tách biệt khỏi trang chủ `/` của nhóm âm),
đọc dữ liệu qua `getShapeLanguageData`/`getShapeGroup` trong `vocabStore.ts`. Hiện chỉ có dữ liệu cho
tiếng Trung và tiếng Nhật (chưa làm tiếng Hàn — xem lý do ở mục bên dưới).

## Bật cronjob tự động (chưa bật sẵn)

`src/lib/ai/expandBatch.ts` là logic dùng chung cho cả nút bấm thủ công trong `/admin` lẫn
cronjob tự động sau này. Để bật tự động trên Vercel: thêm `vercel.json` với mục `crons` gọi
`POST /api/admin/expand-batch` theo lịch, kèm cơ chế xác thực riêng cho request từ cron
(vd. header bí mật) vì middleware hiện chỉ chấp nhận session cookie của admin.

## Deploy

Deploy lên [Vercel](https://vercel.com/new) — thêm toàn bộ biến môi trường trong `.env.example`
vào phần Environment Variables của project trên Vercel.

## Hướng mở rộng vốn từ & mindmap (2026-07-24)

Sau nhiều vòng mở rộng thủ công (hiện tại: `data/zh.json` 145 nhóm/927 từ, `data/ja.json` 101
nhóm/746 từ, `data/ko.json` 78 nhóm/546 từ), phần **tiếng Nhật đã bắt đầu chạm trần** — phần lớn
nhóm âm phổ biến đã có 5–6 chữ gốc, mỗi vòng mới phải đào sâu vào chữ hiếm hơn. Ba hướng dưới đây
là ý tưởng để tiếp tục.

### 1. Tiếp tục đào sâu tiếng Trung trước — ✅ đang làm

Tiếng Trung còn dư địa nhiều hơn Nhật/Hàn vì **thanh điệu tách nhóm**: "wèi" (4) và "wéi" (2) là
hai nhóm khác nhau, nên số tổ hợp pinyin+thanh nhiều hơn hẳn số tổ hợp on'yomi/Hangul tương ứng.
Đang tiếp tục theo đúng quy trình đã dùng cho `ja.json` — vừa mở rộng nhóm cũ (thêm chữ gốc mới
cùng âm+thanh vào nhóm đã có) vừa thêm nhóm mới, ưu tiên chủ đề còn thiếu (lập trình, phim/anime,
đời sống hằng ngày).

### 2. Trục nhầm lẫn mới: **hình chữ giống nhau** (bộ thủ / nét gần giống) — ✅ đã triển khai

Ý tưởng gốc của app là "chữ đọc giống nhau nhưng nghĩa khác nhau". Nhưng với người học chữ Hán/Kanji,
có một loại nhầm lẫn khác cũng phổ biến không kém: **chữ VIẾT gần giống nhau nhưng đọc/nghĩa khác
hẳn** — tiếng Trung gọi là 形近字 (hình cận tự). Đã triển khai thành trục mindmap thứ hai, độc lập với
nhóm âm — xem chi tiết cấu trúc & cách truy cập ở mục [Cấu trúc dữ liệu](#cấu-trúc-dữ-liệu) phía
trên (`/shapes`, `data/zh-shape.json`, `data/ja-shape.json`). Đã seed 40 nhóm tiếng Trung (36 nhóm
độc thể tự — 未/末, 士/土, 己/已/巳, 日/曰, 大/太/犬, 千/干, 手/毛, 戊/戌/戍/戎, 少/小, 人/入/八, 木/术,
白/自, 又/叉, 刀/刃, 王/玉, 免/兔, 今/令, 天/夫, 用/甩, 由/甲/申, 户/尸, 儿/几, 厂/广, 且/旦, 乌/鸟,
九/丸, 巾/币, 王/主, 午/牛, 心/必, 弓/引, 了/子, 寸/才, 平/乎, 幸/辛, 瓜/爪 — cộng 4 nhóm hình thanh tự
mới: 青/情/清/请/晴/睛, 交/校/较/胶/郊/饺, 包/饱/抱/泡/跑/炮, 主/住/注/柱/驻) và 22 nhóm tiếng Nhật
(bằng danh sách độc thể tự tiếng Trung trừ 木/术, 又/叉, 免/兔, 用/甩, 户/尸, 儿/几, 厂/广, 乌/鸟, 巾/币,
平/乎) — lưu ý các cặp
gắn với đặc thù CHỮ GIẢN THỂ Trung Quốc đều KHÔNG mirror sang tiếng Nhật vì chữ phồn thể/shinjitai
tương ứng (術/戸/鳥/幣...) hình dạng khác hẳn hoặc ký tự không tồn tại/không thông dụng trong tiếng
Nhật (riêng 平/乎 bỏ vì 乎 hiếm dùng trong tiếng Nhật hiện đại) — luôn cần kiểm tra hình dạng chữ
Nhật thực tế trước khi mirror. Từ vòng 王/主 trở đi, cho phép TÁI SỬ DỤNG 1 chữ gốc đã có ở nhóm khác
nếu nó tạo điểm nhầm lẫn thật sự khác, miễn kiểm tra kỹ tránh trùng headword.

**Phương pháp mới từ vòng 8**: khi vốn nhớ không đủ chắc chắn để tự soạn thêm, đã dùng WebSearch +
WebFetch tra cứu các nguồn dạy tiếng Trung thực tế (qqxiuzi.cn, baike.baidu.com...) để XÁC MINH cặp
mới trước khi thêm, thay vì đoán hoặc bỏ qua — nhờ vậy xác nhận lại được cả cặp 幸/辛 (từng bỏ qua vì
không chắc) lẫn tìm thêm 寸/才, 平/乎, 瓜/爪. Đây là cách nên dùng tiếp cho các vòng sau khi cần mở
rộng thêm cặp mới mà không chắc chắn từ trí nhớ — tra cứu trước khi ghi, không suy diễn.

**Nhánh mới: nhóm hình thanh tự (形声字) chung thanh phù** — người dùng chỉ ra một kiểu nhầm lẫn
khác chưa được khai thác: chữ GHÉP (hợp thể tự) chia sẻ cùng 1 "thanh phù" (phần gợi âm, thường bên
phải/dưới) nhưng khác "bộ thủ" (phần gợi nghĩa, thường bên trái) — vd họ 青: 情(qíng)/清(qīng)/请(qǐng)/
晴(qíng)/睛(jīng) đều giống hệt bên phải, chỉ khác bộ thủ trái (忄/氵/讠/日/目). Khác với 36 nhóm độc
thể tự ở trên (chỉ khác 1-2 nét, đọc khác hẳn nhau), nhóm hình thanh tự vừa GIỐNG HÌNH vừa GẦN GIỐNG
ÂM — nhầm lẫn kép, giá trị sư phạm cao. Dùng chung 100% cấu trúc `groupKind: "shape"` đã có (không
sửa code), chỉ khác quy mô: mỗi nhóm có 4-5 "chữ gốc" thay vì 2-3 như trước. Đã seed 11 họ tiếng
Trung: 青, 交, 包, 主, 分, 半, 也, 相, 生, 工, 古 (47 nhóm tiếng Trung tổng cộng — 36 độc thể tự + 11
hình thanh tự) — mỗi họ đều tra cứu qua WebSearch trước khi soạn (nguồn: baidu zhidao, ximalaya...)
để xác nhận đúng bộ thành viên + cách phân biệt bộ thủ, không suy diễn từ trí nhớ.

**Đã bắt đầu mirror sang tiếng Nhật** cho họ nào xác minh được on'yomi nhất quán VÀ không dính bẫy
giản thể: họ **生** (星/性/姓/牲) mirror thành công — thú vị là âm On tiếng Nhật của cả 4 chữ đều
GIỐNG HỆT NHAU (せい sei), nhất quán hơn cả tiếng Trung (nơi 牲 lệch hẳn sang shēng). Ngược lại, họ
**工** (江/红/空/功) và **古** (姑/估/枯/故/苦) phải để ZH-only: 工-family vướng đúng bẫy giản thể quen
thuộc (红 giản thể dùng 纟, phồn thể/Nhật dùng 糸 phức tạp hơn hẳn trong 紅); 古-family thì 姑/估 tuy
tồn tại trong tiếng Nhật nhưng hiếm dùng trong từ vựng hiện đại, mirror sẽ thiếu từ vựng chất lượng.
Kết luận: mirror họ thanh phù sang tiếng Nhật khả thi nhưng phải xác minh TỪNG chữ (không chỉ hình
dạng mà cả độ phổ biến từ vựng), tốn công hơn hẳn so với 36 nhóm độc thể tự trước đó.

**Vòng tiếp theo** (theo yêu cầu "không cần tập trung vào từ hiếm dùng"): thêm 3 họ ưu tiên từ vựng
thông dụng hàng ngày — **皮** (波/坡/披/破/疲), **元** (玩/远/园 — phát hiện thú vị: 远/园 vốn dùng
thanh phù 袁 phức tạp, giản thể hoá rút gọn thành 元 nên giờ nhìn giống 玩 hệt, phồn thể/Nhật vẫn giữ
袁 nên KHÔNG mirror được), **巴** (爸/怕/爬/把/吧 — một trong những họ dùng nhiều nhất, có cả "爸"
chính là từ "ba" tiếng Việt vay mượn!). Tổng hiện tại: **50 nhóm tiếng Trung** (36 độc thể tự + 14
hình thanh tự), **23 nhóm tiếng Nhật**.

**Vòng kế tiếp**: thêm 3 họ — **寺** (诗/待/持/特, mirror được sang tiếng Nhật dùng 詩 phồn thể vì
phần thanh phù 寺 vẫn giữ nguyên dù bộ ngôn 言/讠 khác nhau; lưu ý bắt được 1 chi tiết dễ sai: 时
KHÔNG thuộc họ này vì giản thể đã rút gọn 寺 thành 寸, không còn giữ hình 寺 nguyên vẹn), **里**
(理/鲤/埋, ZH-only vì 鲤 phồn thể/Nhật là 鯉 phức tạp hơn), **采** (彩/菜/踩/睬, ZH-only). Trong lúc
soạn phát hiện và sửa 1 lỗi thật: gõ nhầm tiếng Anh "support" thay vì "支持" ở 1 từ tiếng Nhật —
bắt được nhờ luôn đọc lại kết quả trước khi coi là xong. Tổng hiện tại: **53 nhóm tiếng Trung** (36
độc thể tự + 17 hình thanh tự), **24 nhóm tiếng Nhật**.

Còn rất nhiều họ thanh phù khác chưa khai thác (者/每/尧/化/由/加/台...), đây là nguồn nội dung LỚN
HƠN NHIỀU so với độc thể tự đã gần cạn — nên là hướng ưu tiên nếu tiếp tục mở rộng trục hình chữ.

Với tiếng Hàn, trục tương ứng có thể là hanja gốc gần giống, hoặc ở mức Hangul là các âm tiết dễ nhầm
khi viết tay/gõ nhanh (아/어, 오/우, ㅁ/ㅂ) — ít giá trị hơn vì Hangul dễ phân biệt hơn chữ Hán nhiều.
**Đã xác nhận: hợp lý và đáng làm** — cuối cùng chỉ cần thêm 1 field `groupKind?: "sound" | "shape"`
vào `SoundGroup` sẵn có (không cần kiểu `ShapeGroup` riêng), tái dùng 100% renderer/`GroupExplorer`/
`ReviewSession` hiện tại, không đụng vào layout vì vẫn là cây 1 cấp.

### 3. Mạng lưới ngữ cảnh/kịch bản liên kết nhiều câu (ý tưởng lớn nhất, cần cân nhắc kỹ)

Ý tưởng của tác giả: thay vì mindmap chỉ gom từ theo âm đọc, xây một lớp mindmap khác gom theo
**chuỗi tình huống/nhân-quả trong đời sống** — vd "trời mưa" → "tôi bị ướt", "tôi ở nhà"; và
"tôi bị sốt" → "tôi ở nhà", "tôi không đi học" → cùng trỏ tới nút chung "tôi ở nhà". Qua nhiều
tình huống, các câu/từ dùng chung sẽ tự nhiên tạo thành **một mạng lưới (graph)** thay vì các cây
tách rời.

**Về sư phạm: rất hợp lý** — đây đúng là cách học "theo chuỗi chức năng/tình huống" (functional
chaining), được biết là hiệu quả cho phản xạ hội thoại, khác hẳn mục tiêu hiện tại của app (phân
biệt phát âm). Hai mục tiêu này bổ sung cho nhau chứ không thay thế.

**Về kỹ thuật: đây không phải mở rộng nhỏ, mà là một tính năng mới** — đã kiểm tra code render
mindmap hiện tại (`src/lib/mindmapLayout.ts`, `src/components/mindmap/MindmapCanvas.tsx`):
- Renderer hiện tại tự viết layout (không dùng React Flow/dagre), giả định **cây thuần túy**: mỗi
  `VocabWord` có đúng 1 vị trí x/y và đúng 1 đường nối tới đúng 1 cha. Trường `children` đã tồn tại
  trên `VocabWord` (dùng cho tính năng "Mở rộng nhánh" bằng AI) nhưng vẫn là cây 1-cha, không phải
  đồ thị nhiều-cha.
- Để 1 câu ("tôi ở nhà") được nhiều tình huống khác nhau cùng trỏ tới (nhiều cha), cần: (1) cấu
  trúc dữ liệu mới hoàn toàn khác `SoundGroup`/`RootEntry`/`VocabWord` (vd `ScenarioNode { id, text,
  meaningVn, links: [{ toId, relation }] }`), (2) viết lại thuật toán layout để xử lý đồ thị (DAG)
  thay vì cây — node xuất hiện nhiều nơi hoặc dùng đường nối chéo tới 1 vị trí cố định, (3) render
  lại phần connector SVG cho phù hợp.
- **Khuyến nghị**: nên tách hẳn thành 1 chế độ/mục riêng trong app (vd "Mạng ngữ cảnh") thay vì cố
  nhét vào mindmap nhóm âm hiện có, để không làm rối mục đích của mindmap gốc. Nên bắt đầu thử
  nghiệm nhỏ (~15–20 câu/tình huống cho 1 ngôn ngữ) để kiểm chứng cách hiển thị & cách học có hiệu
  quả thật không, trước khi đầu tư viết lại renderer.

**Tóm lại theo độ ưu tiên đề xuất**: (1) tiếp tục zh.json — làm ngay; (2) trục hình chữ giống nhau —
đáng làm, chi phí thấp, có thể làm song song; (3) mạng ngữ cảnh — ý tưởng tốt nhưng là dự án riêng,
nên prototype nhỏ trước khi cam kết viết lại renderer.

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
