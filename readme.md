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

**Vòng kế tiếp**: thêm 3 họ ZH-only — **者** (猪/诸/都/煮 — 猪 nghĩa "lợn" khác nghĩa tiếng Nhật
"lợn rừng", nên không mirror), **台** (抬/胎/怠/治 — minh hoạ rõ thanh phù chỉ gợi ý GẦN đúng: 4 chữ
đọc khá khác nhau dù cùng hình 台), **加** (架/驾/嫁/茄 — 驾 phồn thể/Nhật là 駕 phức tạp hơn nên cả
họ để ZH-only). Tổng hiện tại: **56 nhóm tiếng Trung** (36 độc thể tự + 20 hình thanh tự), **24
nhóm tiếng Nhật**.

**Vòng kế tiếp**: thêm 2 họ — **每** (海/梅/悔/霉, mirror 3/4 sang tiếng Nhật dùng 毎 — biến thể
Nhật của 每 — bỏ 霉 vì không phải kanji thường dùng ở Nhật), **由** (油/邮/抽, ZH-only — phát hiện
1 bẫy mới: 邮 phồn thể/Nhật là 郵, dùng hẳn 垂 thay vì 由 làm thanh phù, khác hoàn toàn hình dạng,
không giống các bẫy giản thể-đơn-giản trước đó chỉ đổi bộ thủ). Tổng hiện tại: **58 nhóm tiếng
Trung** (36 độc thể tự + 22 hình thanh tự), **25 nhóm tiếng Nhật**.

**Vòng kế tiếp**: thêm 2 họ — **反** (饭/板/返/版, mirror 3/4 sang tiếng Nhật — bỏ 饭 vì phồn thể/
Nhật là 飯 dùng 食 đầy đủ thay vì 饣), **果** (棵/颗/裸/课, ZH-only — có 2 lượng từ 棵/颗 dùng để đếm
cây và vật tròn nhỏ, ví dụ minh hoạ dạng cụm từ "一棵树"/"一颗星" thay vì từ đơn lẻ, vẫn là vốn từ
rất cơ bản dù không phải "từ" theo nghĩa thông thường). Tổng hiện tại: **60 nhóm tiếng Trung** (36
độc thể tự + 24 hình thanh tự), **26 nhóm tiếng Nhật**.

**Vòng kế tiếp**: thêm 2 họ ZH-only — **尧** (烧/浇/晓/绕, từ vựng rất thông dụng nhưng phồn thể/
Nhật đổi cả 4 bộ thủ + phần 尧→尭 hơi khác nên bỏ qua mirror), **甫** (捕/浦/铺/哺 — lưu ý bắt được 1
bẫy mới: 补 (vá) trông giống nhưng KHÔNG thuộc họ này vì giản thể đã đổi 甫 thành 卜, khác thanh phù
hẳn, không phải chỉ đổi bộ thủ như các bẫy trước). Tổng hiện tại: **62 nhóm tiếng Trung** (36 độc
thể tự + 26 hình thanh tự), **26 nhóm tiếng Nhật**.

**Vòng kế tiếp** (theo yêu cầu "ưu tiên thanh phù đẻ ra nhiều chữ nhất trước"): tra cứu được danh
sách thanh phù NĂNG SẢN NHẤT tiếng Trung (占, 包, 交, 分, 青 đều ~30-33 chữ phái sinh — đã làm hết
4/5 trước đó) — thêm 2 họ lớn còn thiếu: **占** (站/战/沾/贴/点, 5 chữ, thanh phù năng sản bậc nhất
với ~30 chữ phái sinh, chọn 5 chữ từ vựng thông dụng nhất) và **隹** (难/准/谁/推, cũng rất năng
sản — chuy, bộ chim đuôi ngắn). Cả 2 đều ZH-only vì phồn thể/Nhật đổi khác nhiều (战→戦 cấu trúc
khác hẳn, 难→難 phức tạp hơn nhiều). Tổng hiện tại: **64 nhóm tiếng Trung** (36 độc thể tự + 28 hình
thanh tự), **26 nhóm tiếng Nhật**.

**Vòng kế tiếp**: thêm **兆** (桃/逃/跳/挑, mirror sang tiếng Nhật thành công — có 桃太郎 Đào Thái
Lang và 挑戦 rất quen thuộc) và **冈** (刚/钢/纲, ZH-only — đặc biệt cả 3 chữ đọc GIỐNG HỆT NHAU dù
khác bộ thủ, phồn thể/Nhật dùng 岡 khác hẳn 冈). Tổng hiện tại: **66 nhóm tiếng Trung** (36 độc thể
tự + 30 hình thanh tự), **27 nhóm tiếng Nhật**. Lưu ý: trong lúc soạn bắt được 1 lần trùng headword
"逃跑" với từ đã dùng ở họ 包 (bao-zu) trước đó — sửa thành "逃走".

**Vòng kế tiếp**: thêm **己** (记/纪/忌/起, mirror sang tiếng Nhật dùng 記/紀 phồn thể — 己 vốn đã
dùng làm chữ gốc độc lập ở nhóm 己/已/巳 trước đó, giờ tái dùng ở vai trò KHÁC hẳn: thanh phù trong
chữ ghép) và **京** (惊/景/鲸/凉, ZH-only — phát hiện 惊 phồn thể/Nhật là 驚 đổi hẳn sang thanh phù
敬, không còn giữ 京 nữa, khác kiểu bẫy thông thường chỉ đổi bộ thủ). Tổng hiện tại: **68 nhóm tiếng
Trung** (36 độc thể tự + 32 hình thanh tự), **28 nhóm tiếng Nhật**.

**Vòng kế tiếp** (theo yêu cầu tra cứu có hệ thống hơn qua các bộ thủ/thanh phù còn lại): thêm
**曾** (增/憎/赠/僧, mirror sang tiếng Nhật dùng 曽 — biến thể Nhật của 曾, giống kiểu 每/毎 đã làm
trước; lưu ý bắt được 层 KHÔNG thuộc họ này vì giản thể đã rút gọn hẳn, mất hình 曾) và **中**
(忠/仲/冲/肿, ZH-only vì 肿 phồn thể/Nhật là 腫 đổi hẳn thanh phù sang 重). Tổng hiện tại: **70 nhóm
tiếng Trung** (36 độc thể tự + 34 hình thanh tự), **29 nhóm tiếng Nhật**.

**Phương pháp mới theo đề xuất người dùng**: thay vì tìm từng thanh phù một, tra cứu 1 lượt danh
sách các thanh phù "năng sản nhất" (組字能力最強) — nguồn xác nhận thêm **各, 令, 且, 分, 占, 干, 合**
là nhóm mạnh nhất (令/且/分/占 đã làm trước đó). Thêm 2 họ còn thiếu: **各** (格/客/路/落, mirror
sang tiếng Nhật thành công) và **合** (盒/鸽/给/哈, ZH-only). Tổng hiện tại: **72 nhóm tiếng Trung**
(36 độc thể tự + 36 hình thanh tự), **30 nhóm tiếng Nhật**. Cách tra cứu-theo-danh-sách này hiệu quả
hơn hẳn tìm từng cái — nên áp dụng tiếp cho các vòng sau: tìm thêm danh sách thanh phù năng sản
(không chỉ top 7 mà cả nhóm hạng trung, thường vẫn cho 3-5 chữ chất lượng) rồi lọc theo độ phổ biến
từ vựng trước khi soạn.

**Kiểm tra độ đầy đủ (theo yêu cầu người dùng)**: tra thêm 1 lượt, phát hiện danh sách top-7 CHƯA
đầy đủ — còn 1 tầng "hạng 2" (欠, 见, 隹, 皮, 斤, 殳), trong đó 隹/皮 đã làm. Tra cứu tiếp 欠 và 斤 thì
phát hiện quan trọng: cả 2 đều là BỘ THỦ NGHĨA (không phải thanh phù thật) — các chữ dùng chúng đọc
hoàn toàn khác nhau (次/软/吹/歌 = cì/ruǎn/chuī/gē), khác hẳn tiêu chí "cùng thanh phù → đọc gần
giống nhau" đã dùng xuyên suốt. Bảng xếp hạng gốc đo "tần suất xuất hiện bên phải chữ" nên lẫn cả
bộ thủ nghĩa lẫn thanh phù thật — phải tự lọc lại. Kết luận: danh sách thanh phù THẬT SỰ năng sản
nhất coi như đã khai thác hết (各/令/且/分/占/干/合/隹/皮).

**Chuyển sang "đi sâu"**: mở rộng thêm thành viên cho các họ lớn đã có thay vì tạo họ mới nông —
thêm 精/静/蜻 vào họ 青 (5→8 thành viên, nhóm lớn nhất hiện tại) và 店 vào họ 占 (5→6), 胞 vào họ 包
(5→6). Verify qua app thật: nhóm 8-thành-viên (青) và 6-thành-viên (占) vẫn render đẹp, layout tự
co giãn hợp lý (65-85% zoom tuỳ độ rộng). Đây là hướng nên tiếp tục — còn khá nhiều họ khác (交/分/
半/己/生/工/古/皮/寺/由/反/果/尧/甫/每/兆/己/京/曾/中/各/合) có thể mở rộng thêm 1-2 thành viên mỗi
họ mà không cần tìm thanh phù mới.

**Vòng đi sâu tiếp theo**: mở rộng thêm 2 họ nữa — 分 (4→6, thêm 盆/扮) và 半 (5→7, thêm 叛/胖— nhóm
7-thành-viên, verify layout vẫn đẹp qua app thật). Tổng vẫn 72 nhóm tiếng Trung (không tạo nhóm mới,
chỉ làm giàu nhóm sẵn có) — 762 id, không trùng lặp.

**Vòng đi sâu tiếp theo nữa** (trả lời "đã đầy đủ chưa?"): CHƯA đầy đủ — tiếp tục mở rộng 4 họ:
交 (5→7, thêm 效/跤), 生 (4→5, thêm 胜 — minh hoạ rõ trường hợp cùng thanh phù nhưng đọc lệch hẳn
sang shèng), 皮 (5→6, thêm 玻 — từ 玻璃/thủy tinh rất phổ biến), 己 (4→5, thêm 杞 — chỉ dùng cho
từ 枸杞/kỷ tử). Ghi chú riêng: 杞 KHÔNG phải chữ joyo bên Nhật nên chỉ thêm ở data/zh-shape.json,
không mirror sang ja-shape.json (mọi họ khác thêm lần này cũng không cần mirror mới vì ja-shape đã
có sẵn từ trước hoặc không đủ phổ biến bên Nhật). Tổng hiện tại: **72 nhóm tiếng Trung, 775 id, 463
headword — không trùng lặp**; **30 nhóm tiếng Nhật, 254 id, 148 headword — không trùng lặp**. Verify
qua app thật (tsc + eslint sạch, Playwright screenshot 4 nhóm 皮/己/交/生 đều render đúng, không lỗi
console). Các họ còn lại có thể đào sâu thêm: 工/古/寺/由/反/果/尧/甫/每/兆/京/曾/中/各/合/占/包/半/分.

**Quay lại "mở rộng" theo đúng đề xuất gốc của người dùng** (research liệt kê thanh phù trước, tạo
nhóm trước, vocab sau) — người dùng nhận xét 72 nhóm còn ít so với số lượng thanh phù năng sản thực
tế trong tiếng Trung, nên ưu tiên TẠO NHÓM MỚI (breadth) thay vì tiếp tục đào sâu nhóm cũ. Research +
verify qua WebSearch (pinyin thực tế của từng chữ phái sinh, không đoán) 8 họ thanh phù hoàn toàn
mới, thêm vào data/zh-shape.json:
- **方** (7 thành viên: 访/仿/放/芳/房/纺/防) — họ năng sản mạnh, đọc gần giống hệt nhau.
- **票** (3 thành viên: 漂/飘/缥) — họ nhỏ hơn, 漂 có 3 âm đọc tuỳ nghĩa (piāo/piǎo/piào).
- **其** (4 thành viên: 期/欺/棋/旗) — lưu ý phát hiện quan trọng: 骑 (cưỡi) trông giống nhưng thanh
  phù thật là **奇** chứ không phải 其 — dễ nhầm 2 bộ phận nhìn giống nhau, đã loại 骑 ra khỏi nhóm.
- **尤** (4 thành viên: 优/忧/犹/鱿) — pinyin không dấu trùng với họ 由 (you) đã có sẵn, phải đặt id
  riêng (zh-shape-you2) và ghi chú rõ để tránh nhầm 2 họ.
- **令** (5 thành viên: 冷/邻/铃/岭/龄) — khai thác từ chữ 令 vốn trước đó chỉ dùng làm cặp độc thể
  今·令; giờ mới mở rộng sang họ hình thanh tự đầy đủ của nó.
- **且** (4 thành viên: 租/组/祖/阻) — tương tự, 且 trước đó chỉ có cặp 且·旦; đọc LỆCH hẳn sang zū/zǔ
  (giống ca 生→牲/胜) nhưng vẫn đúng tiêu chí vì tự nó là 1 họ đọc giống nhau.
- **干** (5 thành viên: 杆/竿/肝/赶/秆) — tương tự, tách từ cặp độc thể 千·干; 干 là 1 trong các thanh
  phù năng sản nhất (hơn 50 chữ phái sinh theo nguồn tra cứu).
- **至** (4 thành viên: 致/窒/侄/蛭) — cẩn thận loại bỏ 到 (dào) và 室 (shì) dù cùng chứa 至, vì đọc
  lệch quá xa so với tiêu chí "đọc gần giống nhau", tránh làm loãng nhóm.

Tất cả 8 họ mới đều **ZH-only trong vòng này** — chưa mirror sang ja-shape.json vì cần kiểm tra kỹ
độ phổ biến joyo kanji của từng chữ trước (ví dụ 仿 tiếng Nhật dùng 倣 — không phải chữ joyo — nên
mirror cả nhóm 方 sẽ cần loại riêng biệt từng thành viên, để lại cho vòng sau). Không đoán hanViet
cho các chữ chưa chắc (纺/鱿/赶/秆/致/窒/蛭 — để trống field hanViet).

Kết quả: **80 nhóm tiếng Trung (72→80), 877 id, 521 headword — không trùng lặp**; tsc + eslint sạch;
Playwright kiểm tra cả 8 nhóm mới không có lỗi console, layout render đúng kể cả nhóm 7-thành-viên
(方) lẫn nhóm 3-thành-viên nhỏ (票). ja-shape.json không đổi (vẫn 30 nhóm, 254 id, 148 headword).

**Vòng "tạo khung nhóm rỗng, chưa cần từ vựng"** (theo yêu cầu: đầy đủ cả 2 ngôn ngữ trước, vocab
điền sau — app đã có sẵn nút "✨ Thêm từ" theo từng root + cơ chế `runExpandBatch`/AI tự động điền
từ cho root nào < 5 từ, nên tạo khung trước là hợp lý, khỏi phí công viết ví dụ ngay). Làm 2 việc:

1. **Thêm 1 họ ZH mới**: 奇 (骑/绮/崎/寄) — phát hiện quan trọng khi làm 其 tuần trước: 骑 (cưỡi)
   trông giống nhưng KHÔNG cùng họ với 其 (thanh phù thật là 奇), giờ tách hẳn thành họ riêng.
2. **Mirror 21 họ hình thanh tự ZH-only sẵn có sang tiếng Nhật** (trước đó chỉ có 8/44 họ có bản
   Nhật): 青→sei2, 交→kou, 包→hou, 主→juu, 工→kou2, 古→ko, 皮→ha, 里→ri, 者→sha, 台→tai, 占→ten,
   隹→sui, 冈→gou (Nhật dùng dạng phồn thể đầy đủ 岡), 京→kei, 中→chuu, 方→hou2, 其→ki2, 令→rei,
   且→so, 也→ya, 相→sou. Mỗi họ đều lọc bớt thành viên không phải joyo kanji ở Nhật hoặc rơi vào
   bẫy giản thể đã biết trước — ví dụ 惊 (họ 京) và 肿 (họ 中) đã đổi hẳn thanh phù thật khi giản
   lược nên bị loại; 邻 (họ 令) tiếng Nhật/phồn thể dùng 隣 (từ 粦) hoàn toàn không liên quan đến
   令, chỉ là trùng hợp bên giản thể; 战 (họ 占) cũng vậy — phồn thể là 戰 (từ 單) chứ không phải
   từ 占. Verify joyo-kanji qua WebSearch cho các trường hợp không chắc (xác nhận 剛/棋 LÀ joyo,
   xác nhận 姪/舗 KHÔNG phải joyo nên bỏ luôn 2 họ 至/甫 vì sau khi lọc chỉ còn 2 thành viên, quá
   mỏng). Các họ quá mỏng sau khi lọc (chỉ còn 1-2 thành viên joyo) bị bỏ qua hẳn: 至, 甫, 尤, 干,
   票, 巴, 元, 采, 由, 果, 尧, 合, 加, 分, 半.

Tất cả nhóm mới đều **để `words: []` (rỗng)** — chỉ có khung: ký tự + hanViet (khi chắc chắn) +
nghĩa tiếng Việt ngắn + giải thích bộ thủ. Người dùng có thể xem ngay cấu trúc nhóm trong app, dùng
nút "✨ Thêm từ" để AI điền từ vựng cho từng root khi cần.

Kết quả: **81 nhóm tiếng Trung** (882 id, 521 headword — không trùng lặp); **51 nhóm tiếng Nhật**
(30→51, 351 id, 148 headword — không trùng lặp). tsc + eslint sạch. Playwright xác nhận layout với
`words: []` không bị lỗi/crash — root hiện đúng với nút "Thêm từ", cả bên ZH (骑绮崎寄) lẫn JA (方
6-thành-viên, 岡 3-thành-viên).

**Vòng "chuyển sang cách research có hệ thống"** — người dùng hỏi thẳng "sao ít nhóm vậy, 2 bộ thủ
random gộp lại chẳng phải sẽ ra rất nhiều nhóm sao?". Nhận ra cách research thủ công (mỗi lần
WebSearch 1 họ) không thể theo kịp quy mô thật của tiếng Trung — nên đổi cách tiếp cận: tải dữ liệu
mở **cjkvi-ids** (bảng phân rã hình chữ Hán thành các cấu kiện, ví dụ 清 = ⿰氵青) và **hanziDB**
(bảng tần suất dùng + pinyin cho ~9900 chữ Hán thường dùng), viết script Node.js đối chiếu 2 bảng
này để **tự động dò ra mọi cấu kiện xuất hiện bên phải (hoặc bên dưới) của ≥3 chữ thường dùng
(rank ≤ 3000) mà các chữ đó đọc gần giống nhau (cùng vần)** — thay vì nhớ/tra từng họ một theo trí
nhớ hoặc từng câu WebSearch riêng lẻ. Kết quả: chỉ riêng 1 lần chạy đã lộ ra **51 họ thanh phù mới**
chưa từng được khai thác (几, 旁, 马, 丁, 少, 长, 仑, 申, 召, 亥, 乔, 俞, 喿, 莫, 勾, 卜, 义, 王, 及,
支, 只, 正, 旦, 巨, 圭, 艮, 朱, 夹, 我, 肖, 矣, 佥, 宛, 咅, 尚, 直, 宗, 枼, 畐, 尃, 䍃, 粦, 丑, 奂, 匋,
夆, 肙, 胡, 㐬, 星, 兰) — xác nhận trực tiếp trực giác của người dùng: không gian thật lớn hơn nhiều
so với 44 họ tìm thủ công trước đó.

Phát hiện thú vị trong lúc lọc dữ liệu:
- Nhiều họ có ĐỘ TRÙNG HÁN VIỆT tuyệt đối, không chỉ trùng pinyin — ví dụ 几-family (机/玑/肌/讥/饥)
  đều đọc "cơ"; 喿-family (噪/澡/燥/躁) đều đọc "táo"; 咅-family (培/赔/陪) đều đọc "bồi"; 枼-family
  (碟/蝶/谍) đều đọc "điệp"; 粦-family (磷/鳞/麟) đều đọc "lân"; 夆-family (峰/蜂/锋) đều đọc "phong";
  肙-family (娟/捐/绢) đều đọc "quyên"; 胡-family (湖/糊/蝴) đều đọc "hồ"; 㐬-family (流/琉/硫) đều
  đọc "lưu"; 尃-family (博/搏/膊) đều đọc "bác"; 䍃-family (摇/瑶/谣) đều đọc "dao" — càng củng cố
  mức độ dễ nhầm lẫn.
- Phát hiện hiện tượng "lồng nhau nhiều tầng": 星 vốn đã là 1 thành viên của họ 生 (生→星), nhưng
  bản thân 星 lại là THANH PHÙ cho 1 tầng chữ mới (猩/腥/醒) — ghi chú rõ trong nhóm để không gây
  nhầm lẫn 2 tầng.
- Họ 只 (帜/织/职) là hiện tượng CHỈ CÓ ở giản thể Trung Quốc — phồn thể gốc dùng thanh phù 戠 chứ
  không phải 只, nên đánh dấu rõ "không mirror sang tiếng Nhật".
- Nhiều cấu kiện chỉ tồn tại như "âm phù" cổ, không dùng độc lập trong tiếng Trung hiện đại (喿, 咅,
  枼, 畐, 尃, 䍃, 粦, 丑*, 奂, 夆, 肙, 㐬) — vẫn ghi chú rõ trong `note` để người học không nhầm là
  chữ có thể dùng riêng.

Về mặt kỹ thuật: viết script tạm (không đưa vào repo, chỉ chạy 1 lần trong scratchpad) tự sinh cấu
trúc JSON cho cả 51 nhóm từ bảng dữ liệu đã lọc, rồi ghép vào `data/zh-shape.json`. Việc ghép bằng
`JSON.stringify` mặc định làm hỏng định dạng gọn (mỗi từ vựng 1 dòng) đã dùng xuyên suốt — phát hiện
và sửa ngay bằng 1 hàm serialize tùy chỉnh giữ nguyên style cũ (word object luôn in trên 1 dòng).
Cũng phát hiện và sửa id các root ban đầu lỡ dùng thẳng ký tự Hán (vd `zh-shape-ji3-机`) thay vì theo
đúng quy ước phiên âm đã dùng cả file (đổi lại thành `zh-shape-ji3-ji` v.v.).

Tất cả 51 nhóm đều **`words: []`** (khung trước, vocab sau — theo đúng yêu cầu). Kết quả cuối:
**132 nhóm tiếng Trung** (81→132, 1104 id, 521 headword — không trùng lặp); ja-shape.json không đổi
vòng này (vẫn 51 nhóm). tsc + eslint sạch. Playwright xác nhận nhiều nhóm mới render đúng, không lỗi
console — kể cả các nhóm dùng cấu kiện Hán tự hiếm (粦, 䍃) hiển thị bình thường trên trình duyệt.

Hướng tiếp theo nếu muốn mở rộng hơn nữa: hạ ngưỡng lọc (rank ≤ 3000 → 4000+, hoặc bestCount ≥ 3 →
≥ 2) sẽ lộ thêm nhiều họ nữa nhưng chất lượng/độ phổ biến giảm dần; hoặc chạy phân tích tương tự cho
cấu trúc ⿱ (trên-dưới) và ⿲ (3 phần) chứ không chỉ ⿰ (trái-phải) đã làm; hoặc dùng lại pipeline này
để mirror hàng loạt sang tiếng Nhật (cần thêm 1 bảng joyo-kanji + shinjitai mapping để lọc tự động
thay vì WebSearch từng chữ như các vòng trước).

**Vòng "cào tối đa theo độ thông dụng"** — người dùng xác nhận hài lòng với hướng data-driven, yêu
cầu cào thêm càng nhiều càng tốt, ưu tiên theo tần suất dùng thực tế, và báo cáo trung thực khi cạn
tài nguyên. Mở rộng pipeline theo đúng gợi ý ở vòng trước:
- Nâng ngưỡng tần suất từ rank ≤ 3000 lên **rank ≤ 4500**.
- Phân tích thêm **cả 4 vị trí cấu trúc** (không chỉ ⿰-phải như trước): ⿰-trái, ⿰-phải, ⿱-trên,
  ⿱-dưới. Phát hiện quan trọng: ⿰-trái và ⿱-dưới hầu như luôn là BỘ THỦ NGHĨA (讠亻纟月忄扌土阝心
  艹氵灬 v.v.), không phải thanh phù thật — nếu gộp theo 2 vị trí này sẽ tạo ra các nhóm SAI (chữ
  chỉ tình cờ đọc giống nhau qua các thanh phù KHÁC NHAU, ví dụ nhóm giả "心" ở vị trí dưới gồm
  慧/惠/恚 — 3 chữ đọc gần giống hệt "huì" nhưng 3 thanh phù thật của chúng lại khác nhau hoàn toàn
  彗/⑧/圭). Phát hiện này quan trọng — đã loại bỏ hoàn toàn 2 vị trí ⿰-trái/⿱-dưới khỏi thuật toán,
  chỉ giữ ⿰-phải và ⿱-trên (đúng vị trí thanh phù thật sự trong đa số trường hợp).
- Tự động trích xuất danh sách 99 thanh phù ĐÃ DÙNG từ chính `data/zh-shape.json` (regex trên field
  `note`/`reading`) thay vì gõ tay danh sách loại trừ — tránh trùng lặp chắc chắn hơn.

Kết quả 1 lần chạy: lộ ra **135 candidate mới**, sau khi lọc thủ công loại 3 trường hợp giả (nhóm
艹-wei, 竹-ji, 亦-luan — cùng lỗi "bộ thủ nghĩa tình cờ đọc giống nhau" nêu trên dù nằm ở vị trí
⿱-trên) còn lại **113 họ thanh phù mới xác thực**, được thêm vào `data/zh-shape.json` (khung —
`words: []`, dùng đúng field pinyin/tần suất từ hanziDB để chọn nghĩa + Hán Việt cho từng chữ, không
đoán). Trong đó phát hiện thêm rất nhiều case "trùng Hán Việt tuyệt đối" tương tự vòng trước: 夬-family
(决诀抉→quyết), 屈-family(掘崛倔→quật), 皇-family(煌惶蝗徨隍→hoàng, 5/5), 甬-family(涌踊蛹俑→dũng),
夋-family(俊峻骏竣浚→tuấn, 5/5), 它-family(陀驼鸵沱→đà), 曹/需/龙/宁/宾... rất nhiều.

Vấn đề kỹ thuật phát sinh và đã xử lý:
- 6 cấu kiện thanh phù rơi vào vùng Unicode CJK mở rộng hiếm (𠃓𢀖𠬤𫇦𦐇𫥎, mã U+20000+ trở lên) —
  khi hiển thị trên trình duyệt, 1 trường hợp (𢀖, họ 经径胫泾) bị font hệ thống thay thế nhầm thành
  chữ 圣 hoàn toàn khác nghĩa, gây hiểu lầm. Đã sửa: thay literal glyph trong `reading`/`note` bằng
  mô tả bằng lời ("cấu kiện cổ, dạng hiếm...") cho cả 6 nhóm này — các CHỮ THÀNH VIÊN thực tế (经/径/
  胫/泾, 营/莹/莺/荧/萤/萦, v.v.) đều là chữ thường dùng, hiển thị bình thường, không bị ảnh hưởng.
- Nhiều chữ trong 1 nhóm có cùng pinyin hệt nhau (đúng theo tiêu chí) khiến id root tự sinh theo
  pinyin bị trùng — sửa bằng cách tự thêm hậu tố số thứ tự khi phát hiện trùng trong cùng 1 nhóm.

Kết quả cuối: **245 nhóm tiếng Trung** (132→245, 1609 id, 521 headword — không trùng lặp). tsc +
eslint sạch. Playwright xác nhận không có lỗi console kể cả các nhóm dùng cấu kiện hiếm. ja-shape.json
không đổi vòng này (vẫn 51 nhóm) — ưu tiên tuyệt đối cho bề rộng tiếng Trung theo đúng yêu cầu.

**Về độ "cạn tài nguyên"**: pipeline vẫn còn dư địa mở rộng thêm nếu cần — (1) hạ tiếp ngưỡng tần
suất lên rank ≤ 6000-9900 (toàn bộ hanziDB) sẽ lộ thêm nhiều họ nữa nhưng độ phổ biến giảm dần và
rủi ro sai sót tăng (chữ hiếm, nghĩa khó tra); (2) phân tích cấu trúc ⿲ (3 phần trái-giữa-phải) và
⿳ (3 phần trên-giữa-dưới) hoàn toàn chưa khai thác; (3) hạ ngưỡng số thành viên tối thiểu từ 3 xuống
2 sẽ ra thêm nhiều cặp nhỏ. Tuy nhiên đây là điểm dừng hợp lý cho 1 vòng — 245 nhóm đã bao phủ phần
lớn thanh phù năng sản và phổ biến nhất; các vòng tiếp theo sẽ có lợi suất giảm dần (chữ ít dùng hơn,
cần tra cứu kỹ hơn từng trường hợp để tránh sai). Có thể tiếp tục bất cứ lúc nào nếu muốn.

**Vòng "cào tối đa" tiếp theo** — người dùng xác nhận hài lòng, yêu cầu tiếp tục cào nhiều nhất có
thể theo đúng 2 hướng đã đề xuất: hạ ngưỡng tần suất VÀ thêm cấu trúc 3 phần (⿲/⿳). Thực hiện:

- Nâng ngưỡng tần suất lên **rank ≤ 9900 (toàn bộ hanziDB)**.
- Thêm phân tích **⿲ (trái-giữa-phải)** và **⿳ (trên-giữa-dưới)** — với ⿲ lấy phần phải làm ứng viên
  thanh phù (khớp mẫu 讠/纟/刂 + gốc + phải, ví dụ 辩/辨/辫 chung 辛 + biến thể phải). ⿳ thử lấy phần
  dưới, độ chính xác thấp hơn nên ít cho kết quả lọt qua bộ lọc chất lượng.
- Tự sửa 1 lỗi phát sinh từ vòng trước: bộ lọc "đã dùng" (`covered`) trích từ field `note`/`reading`
  bị bỏ sót 6 nhóm đã đổi sang mô tả bằng lời (không còn ký tự gốc để regex bắt) — khiến 𢀖 (nhóm
  经/径/胫/泾) suýt bị tạo trùng lần 2. Đã bổ sung thủ công 6 mã này vào danh sách loại trừ.
- Thêm 2 bộ lọc chất lượng mới quan trọng:
  1. **Loại trùng phồn/giản thể**: nhiều "thành viên" hóa ra chỉ là bản phồn thể của 1 thành viên
     giản thể khác trong CÙNG nhóm (cùng nghĩa tiếng Anh hệt nhau, ví dụ 错/錯, 咏/詠, 辖/鎋) — không
     phải 2 chữ khác nhau trông giống nhau, mà là 1 chữ viết 2 kiểu. Tự động loại theo gloss trùng
     khớp, ưu tiên giữ bản rank thấp hơn (phổ biến hơn).
  2. **Loại chữ nghĩa trống**: chữ không có gloss tiếng Anh trong hanziDB gần như chắc chắn là chữ
     cổ/hiếm tới mức không đáng đưa vào — dù chỉ là khung, vẫn nên đảm bảo mọi root đều là chữ thật
     sự có thể tra nghĩa được.

Sau khi lọc: từ 375 candidate ban đầu (rank≤9900) còn **260 họ chất lượng cao**; trong đó ưu tiên
theo đúng yêu cầu "độ thông dụng" nên chỉ lấy phần **avgRank ≤ 5000** (125 họ) cho vòng này — phần
avgRank 5000-9900 (135 họ còn lại) để dành cho vòng sau nếu người dùng vẫn muốn tiếp tục (độ hữu ích
giảm dần rõ rệt qua ngưỡng này). Trong 125 họ, loại tiếp 8 họ không đạt chuẩn khi rà tay: **竹** và
**亦** là 2 trường hợp bộ thủ nghĩa giả dạng thanh phù (y hệt bẫy 艹/竹 phát hiện ở vòng trước — 竹
"bamboo" đứng trên 简/箭/笺/笕/簡 nhưng thanh phù thật của mỗi chữ khác nhau hoàn toàn: 间/前/戋/见/間);
**昔, 必, 害, 未, 重, 永** bị loại vì sau khi bỏ thành viên phồn/giản trùng chỉ còn dưới 3 thành viên.

Kết quả: thêm **117 họ mới** (415 root) vào `data/zh-shape.json`, tất cả `words: []`. Một số họ đáng
chú ý: 留-family (7 thành viên: 溜榴馏镏熘蹓骝, 3/7 đọc "lưu"), 建-family (6: 健键腱犍鞬楗), 比-family
(7: 批毗砒纰枇蚍仳), 弗-family (5: 佛拂怫绋鮄 — 佛 chính là "Phật"!). Kết quả cuối: **362 nhóm tiếng
Trung** (245→362, 2141 id, 521 headword — không trùng lặp). tsc + eslint sạch. Playwright xác nhận
render đúng, không lỗi — kể cả 2 nhóm bị trùng id với vòng trước do cùng slug pinyin (东/朋 đọc trùng
"dong"/"peng" với 2 họ đã có) đã tự phát hiện qua bước kiểm tra và đổi tên (`dong5`, `peng5`) trước
khi ghi vào file.

**Cập nhật độ "cạn tài nguyên"**: phần avgRank 5000-9900 (135 họ) vẫn còn nguyên, sẵn sàng cho vòng
sau nếu cần — nhưng độ hữu dụng giảm khá rõ qua mốc 5000 (nhiều chữ bắt đầu là thuật ngữ hóa học/tên
đất/tên người hiếm gặp). Ngoài ra vẫn còn hướng ⿲/⿳ có thể mở với ngưỡng chất lượng cao hơn, và có
thể hạ MIN_MEMBERS xuống 2 để bắt các cặp nhỏ. Nói "tiếp tục" nếu muốn đào tiếp.

**Vòng "cào tiếp vào vùng avgRank 5000-9900"** — người dùng tiếp tục xác nhận hài lòng, lặp lại yêu
cầu cào tối đa theo độ thông dụng. Lấy đúng phần 135 họ còn lại từ vòng trước (avgRank > 5000), nhưng
chỉ xử lý **phân khúc avgRank 5000-6500** (100 họ) trong vòng này — phần 6500-9900 (35 họ) hầu hết là
cụm ký tự CHỈ TỒN TẠI Ở PHỒN THỂ (thanh phù chính là các chữ phồn thể như 義/岡/長/農/喬/馬/頁/龍/盧/婁/幾
— nghĩa là mọi "thành viên" phái sinh cũng chỉ có bản phồn thể, không giúp ích cho người học giản thể
hiện tại), quyết định loại bỏ toàn bộ phân khúc này khỏi phạm vi khai thác thay vì thêm dữ liệu ít
giá trị.

Rà tay 100 họ (5000-6500), loại tiếp **13 họ** không đạt chuẩn:
- **艹** (TB-top, 莉/荔/藜/莅...): lại là bẫy bộ thủ nghĩa giả dạng thanh phù — y hệt 竹/亦 đã gặp,
  8 "thành viên" hóa ra có 8 thanh phù thật khác nhau hoàn toàn (利/劦/黎/位/历/离/涖/立).
- **名, 宅, 詹, 冘, 蚤, 普, 乇, 殹, 冓, 达, 扇, 柬**: đều rơi dưới 3 thành viên sau khi loại bản
  phồn/giản trùng hoặc dữ liệu bị cắt cụt (gloss dở dang kiểu "(simplified form of" không đọc được).

Với 87 họ còn lại, loại thêm **11 thành viên đơn lẻ** trùng phồn/giản trong nội bộ nhóm (không đủ
làm rớt cả nhóm vì vẫn còn ≥3 thành viên sau khi bỏ): 麵(dup của 面), 鉤(dup của 钩 — đã có ở nhóm 勾
từ trước), 緣(dup 缘), 絃(dup 弦), 韌(dup 韧), 軛(dup 轭), 禮(dup 礼, phồn thể độc lập không giúp gì
cho giản thể), 録(dup 录 — chính là gốc component), 饌(dup 馔), 輗(phồn thể độc lập), 貛(dup 獾).

Kết quả: thêm **90 họ mới** (358 root, con số thực tế nhỉnh hơn ước tính 87 vì vài họ rà tay lúc đầu
tưởng loại nhưng xét lại vẫn đạt chuẩn) vào `data/zh-shape.json`. Một số họ đáng chú ý: 㐱-family
(8 thành viên: 珍诊畛胗轸袗紾眕 — 珍/诊 đều rất thông dụng!), 敖-family (7: 熬鳌鏊骜螯獒聱), 卢-family
(7: 鲈胪泸舻轳栌垆), 兒-family (6: 倪睨猊鲵蜺齯 — xác nhận đây là cấu trúc HỢP LỆ trong giản thể, không
phải bẫy phồn thể, vì hầu hết thành viên vẫn giữ nguyên 兒 kể cả trong văn bản giản thể hiện đại do
không nằm trong danh sách quy tắc giản lược). Kết quả cuối: **452 nhóm tiếng Trung** (362→452, 2589
id, 521 headword — không trùng lặp). tsc + eslint sạch. Playwright xác nhận render đúng, không lỗi.

**Cập nhật độ "cạn tài nguyên" (mới nhất)**: phần avgRank 6500-9900 (35 họ) đã bị loại chủ động vì
đa số là cụm phồn-thể-độc-quyền (xem lý do ở trên) — coi như đã khai thác HẾT phần "hình thanh tự
2 phần (⿰/⿱) có giá trị thực tế cho người học giản thể" ở mức rank ≤ 9900 (toàn bộ hanziDB). Hướng
còn lại thực sự chưa khai thác: (1) cấu trúc 3 phần ⿲/⿳ (chỉ mới thử 1 lần cho 辛-family, chưa quét
toàn diện); (2) hạ MIN_MEMBERS xuống 2 (rất nhiều cặp 2-chữ tiềm năng, nhưng rủi ro trùng với các cặp
"hình cận tự" độc thể đã làm ở vòng đầu tiên); (3) nếu muốn nhiều hơn nữa sẽ cần bộ dữ liệu tần suất
lớn hơn hanziDB (chỉ có ~9900 chữ) — tức là vượt ra ngoài phạm vi "chữ Hán thường dùng" sang chữ Hán
đầy đủ (~50000+ chữ trong Khang Hy tự điển), lúc đó gần như chắc chắn chất lượng sẽ giảm mạnh vì đều
là chữ cổ/hiếm/địa danh. Đây là điểm dừng hợp lý nhất — nói "tiếp tục" nếu vẫn muốn khai thác các
hướng còn lại (⿲/⿳ hoặc hạ MIN_MEMBERS), tôi sẽ làm nhưng sẽ báo trước nếu tỷ lệ candidate hợp lệ
quá thấp so với công sức bỏ ra.

**Vòng cuối cùng (theo yêu cầu "thử tiếp tục lần cuối")** — thử đúng 2 hướng còn lại đã hứa:

1. **⿲/⿳ (cấu trúc 3 phần)**: quét toàn diện lần đầu tiên (trước đó chỉ thử ngẫu nhiên 1 lần cho họ
   辛). Kết quả: chỉ tìm lại được đúng 1 candidate — chính là họ 辛 (辩/辨/辫) đã thêm từ vòng trước.
   **Hướng này chính thức cạn hoàn toàn** — không còn thanh phù 3 phần nào khác đạt tiêu chuẩn chất
   lượng trong toàn bộ hanziDB.
2. **Hạ MIN_MEMBERS xuống 2** (chỉ cặp 2 chữ, giới hạn rank ≤ 2500 — nhóm ký tự thông dụng nhất để
   đảm bảo chất lượng): tìm được 50 candidate. Sau khi lọc:
   - **16 cặp đã tồn tại sẵn** trong các nhóm lớn hơn từ những vòng trước (ví dụ 境/镜 đã có trong họ
     竟, 珍/诊 đã có trong họ 㐱, 喉/猴 đã có trong họ 侯...) — loại bỏ để tránh trùng lặp.
   - **7 cặp là bẫy bộ thủ nghĩa giả dạng thanh phù** — phát hiện thêm nhiều trường hợp mới cùng loại
     đã gặp trước (艹/竹/亦/心): 宀 (thực/室, bộ "mái nhà"), 日 (景/晶, bộ "mặt trời"), 鸟 (鸭/鸦, bộ
     "chim"), 攵 (枚/玫), 殳 (役/毅) — đều là bộ thủ nghĩa thật, chỉ tình cờ trùng vần qua các thanh
     phù thật khác nhau ở mỗi chữ; cộng thêm 竹 (简/箭, lặp lại đúng bẫy đã ghi nhận) và 1 trường hợp
     cấu kiện đáng ngờ (⺊, quá nhỏ/không đáng tin làm nhãn thanh phù).
   - Còn lại **27 cặp chất lượng cao, đều nằm trong top 2500 chữ thông dụng nhất** — đặc biệt giá
     trị vì đây là những chữ CỰC kỳ quen thuộc: 成/诚, 财/材, 密/蜜, 转/砖, 练/炼, 忘/妄, 潮/嘲, 灌/罐,
     惧/俱... Một số còn "vớt lại" được từ các họ đã bị loại ở vòng trước vì quá mỏng (dưới 3 thành
     viên) — ví dụ 错/措 (từ họ 昔 loại ở vòng 3), 辖/瞎 (từ họ 害 loại ở vòng 4), 妹/昧 (từ họ 未 loại
     ở vòng 4) — giờ hợp lệ trở lại đúng vì MIN_MEMBERS chỉ còn 2.

Kết quả: thêm **27 họ mới** (54 root, toàn bộ là cặp 2 chữ) vào `data/zh-shape.json`. Kết quả cuối:
**479 nhóm tiếng Trung** (452→479, 2670 id, 521 headword — không trùng lặp). tsc + eslint sạch.
Playwright xác nhận render đúng, không lỗi.

**Kết luận về "cạn tài nguyên"**: đến đây, với phương pháp phân rã IDS + tần suất hanziDB (~9900 chữ
thường dùng) + lọc chất lượng (loại bộ thủ nghĩa giả dạng thanh phù, loại trùng phồn/giản thể, loại
chữ không tra được nghĩa), **cả 2 hướng còn lại đều đã cạn thật sự**: ⿲/⿳ trả về 0 candidate mới,
và MIN_MEMBERS=2 ở ngưỡng rank≤2500 (thông dụng nhất) chỉ còn 27 cặp — nếu hạ tiếp ngưỡng rank cho
cặp 2 chữ thì sẽ bắt đầu chồng lấn nhiều hơn với các cặp "hình cận tự" (nét gần giống) đã làm thủ
công ở giai đoạn đầu dự án, và độ thông dụng cũng giảm dần. Từ 44 nhóm ban đầu (trước khi áp dụng
phương pháp data-driven) đến 479 nhóm sau vòng đó — tưởng đã là điểm dừng tự nhiên.

**Vòng "thật sự cuối cùng"** — người dùng chủ động chấp nhận đánh đổi chất lượng ("toàn chữ cổ/hiếm/
địa danh") để khai thác triệt để phần còn sót. Quay lại đúng 2 vùng dữ liệu đã né ở vòng trước:

1. **Vùng avgRank 6500-9900 (35 họ)** trước đó bị loại bỏ toàn bộ vì nghi ngờ là "cụm phồn-thể-độc-
   quyền". Rà tay kỹ lại từng họ (không loại cả cụm như trước) để phân biệt 2 loại:
   - **Phồn-thể-độc-quyền thật sự** (12 họ: 責/義/岡/長/農/喬/馬/頁/龍/盧/婁/幾— các thanh phù này nằm
     trong danh sách ~132 "bộ thủ giản hóa hệ thống" chính thức của Trung Quốc, nghĩa là MỌI chữ
     chứa chúng đều bị giản lược đồng loạt, không có ngoại lệ) → giữ nguyên quyết định loại bỏ.
   - **Chữ hiếm nhưng vẫn hợp lệ trong giản thể hiện đại** (phần còn lại) — các thanh phù như 雚/矍/
     睘/蒦 v.v. KHÔNG nằm trong danh sách giản hóa hệ thống, nên những chữ hiếm dùng chúng (như 獾,
     攫, 缳...) vẫn giữ nguyên dạng ngay cả trong văn bản giản thể ngày nay, chỉ đơn giản là từ ít
     dùng chứ không phải "sai" hay "phồn thể". Sau khi loại tiếp 2 họ quá mỏng (柬, 巤 — toàn bộ
     thành viên hóa ra trùng với các từ giản thể phổ biến chưa dùng như 练/炼/腊/蜡/萦/萤), còn lại
     **20 họ hợp lệ** (67 root) — thêm vào, có ghi chú rõ "chữ hiếm/cổ văn, chỉ để tham khảo".

2. **Mở rộng ngưỡng cặp 2 chữ (MIN_MEMBERS=2) từ rank≤2500 lên rank≤4500** — tìm được thêm 102 cặp
   mới (sau khi loại các cặp đã có sẵn ở nơi khác). Bất ngờ lớn: **chất lượng vẫn cực cao xuyên suốt
   toàn bộ khoảng rank 2500-4500** — đây vẫn là vùng từ vựng rất thông dụng (谢/榭, 憾/撼, 振/赈, 渡/
   镀, 依, 擦, 帽, 域, 惯, 游, 滚, 抚, 认...). Phát hiện thêm 4 bẫy mới (đều là biến thể của bẫy đã
   biết): **殳** (设, thanh phù nghĩa giả dạng — giống 心/艹/竹/宀/日/鸟), **郑** (掷, bẫy giản thể đổi
   hẳn thanh phù thật giống 战/惊/补), **習** (褶, đọc lệch quá xa + gốc phồn thể), **亏** (污, đọc
   lệch quá xa nghi ngờ bẫy giản thể) — loại cả 4. Còn lại **97 cặp chất lượng cao** — thêm vào.

Kết quả: thêm **20 họ hiếm** (67 root) + **97 cặp thông dụng** (194 root) = tổng **117 nhóm mới**
(261 root) trong vòng này. Kết quả cuối: **596 nhóm tiếng Trung** (479→596, 3048 id, 521 headword —
không trùng lặp). tsc + eslint sạch. Playwright xác nhận render đúng, không lỗi — kể cả nhóm dùng
toàn chữ Hán cổ hiếm gặp (缳/擐/轘/镮).

**Kết luận cuối cùng thật sự**: đến đây, với bộ dữ liệu hanziDB (~9900 chữ) + IDS decomposition, đã
khai thác đến tận đáy — phần còn sót lại ngoài phạm vi 596 nhóm chỉ còn thuần túy chữ phồn-thể-độc-
quyền (không dùng được cho người học giản thể) hoặc chữ vượt ngoài top ~9900 tần suất (cần đổi hẳn
nguồn dữ liệu sang từ điển Khang Hy ~50000 chữ, lúc đó gần như 100% là chữ cổ/hiếm không còn dùng).
Đây mới là điểm dừng tuyệt đối của phương pháp data-driven với dữ liệu hiện có.

### 3. Gom nhóm theo chủ đề (danh mục) — dọn dẹp trang tổng quan sau khi cào 596 nhóm

Sau khi `data/zh-shape.json` phình lên 596 nhóm, trang `/shapes/zh` trở thành 1 lưới phẳng khổng lồ
rất khó duyệt. Người dùng đề xuất gom các nhóm lại theo tiêu chí như bộ thủ, để chuẩn bị bước tiếp
theo là đi vào từng nhóm xây mindmap từ vựng thật.

**Cách tiếp cận đã chọn**: gom theo **chủ đề ngữ nghĩa của bộ thủ chính thức (Khang Hy) của thanh phù
đại diện mỗi nhóm** — không phải bộ thủ của từng thành viên (mỗi thành viên có bộ thủ khác nhau, đó
chính là lý do nhóm tồn tại), mà là bộ thủ CỦA CHÍNH KÝ TỰ THANH PHÙ dùng làm tên nhóm (vd nhóm "青"
— tra 青 trong hanziDB thấy bộ thủ chính thức là 青 → xếp vào chủ đề "Ánh sáng – thời gian"). Quy trình:

1. Trích xuất ký tự thanh phù đại diện của cả 596 nhóm (regex trên field `reading`, cộng thêm xử lý
   riêng 6 nhóm dùng mô tả bằng lời từ vòng trước không có ký tự thanh phù hiển thị trực tiếp).
2. Tra bộ thủ chính thức của từng ký tự thanh phù qua cột `radical` có sẵn trong hanziDB.csv — tìm
   được cho 499/560 nhóm hình thanh tự; 61 nhóm còn lại (thanh phù là cấu kiện cổ không có trong tốp
   9900 chữ thường dùng) xếp vào danh mục riêng "Cấu kiện âm cổ / hiếm gặp".
3. Có 157 bộ thủ Khang Hy khác nhau xuất hiện — quá vụn để làm danh mục trực tiếp, nên gộp tiếp
   thành **14 chủ đề lớn** dễ hiểu bằng tiếng Việt (Con người & cơ thể, Nước – lửa – đất – khí, Cây
   cỏ, Động vật, Nhà cửa – đồ vật, Số đếm – hình trừu tượng, Ngôn ngữ – chữ viết, Kim loại – ngọc, Ăn
   uống, Ánh sáng – thời gian, Cảm xúc – tinh thần, Tiền bạc – giao dịch, cộng 2 danh mục đặc biệt:
   **Cặp ký tự gần giống (hình cận tự)** cho 36 nhóm nguyên bản đầu dự án (không phải hình thanh tự,
   không có 1 thanh phù chung) và **Cấu kiện âm cổ / hiếm gặp** cho 61 nhóm nói trên).
4. Phân bố cuối: Con người & cơ thể (159), Số đếm (103), Nhà cửa – đồ vật (94), Cấu kiện cổ (61),
   Cặp hình cận tự (36), Nước-lửa-đất (32), Cây cỏ (31), Ánh sáng-thời gian (27), Động vật (22), Cảm
   xúc (13), Ngôn ngữ (6), Tiền bạc (6), Ăn uống (5), Kim loại (1) — không còn nhóm "Khác" nào sót lại.

**Thay đổi kỹ thuật**: thêm field `category?: string` vào type `SoundGroup` (`src/types/vocab.ts`) —
hoàn toàn optional, không phá vỡ `getShapeGroup`/`getShapeLanguageData` (vẫn lookup phẳng theo `id`
như cũ) hay trang chi tiết nhóm (`GroupExplorer`, không đọc field này). Viết field `category` vào mọi
group trong `data/zh-shape.json`. Cập nhật `src/app/shapes/[lang]/page.tsx`: gom `data.groups` theo
`category`, hiển thị thanh điều hướng nhanh (chip nhảy tới từng chủ đề) ở đầu trang, mỗi chủ đề là 1
`<details>` (thu/phóng bằng HTML thuần, không cần thêm client-side state) — tự mở sẵn nếu ≤30 nhóm,
thu gọn nếu lớn hơn để trang không quá dài khi tải. `ja-shape.json` (51 nhóm) giữ nguyên dạng phẳng
vì chưa đến mức cần gom (danh sách nhỏ vẫn duyệt được).

Verify: tsc + eslint sạch. Playwright xác nhận: 14 chip điều hướng hiện đúng số lượng từng chủ đề,
mở/thu gọn nhóm hoạt động, click vào 1 nhóm bên trong danh mục đã thu gọn vẫn điều hướng đúng tới
trang chi tiết mindmap (routing theo `id` không bị ảnh hưởng bởi việc thêm `category`).

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

### 4. Trục nhầm lẫn thứ ba (ý tưởng — chưa triển khai): **đa âm Hán Việt / 一字多音**

Khác hẳn 2 trục đã làm (nhiều CHỮ KHÁC NHAU trông/đọc giống nhau → dễ lẫn chữ này ra chữ kia), trục
này đi theo chiều NGƯỢC LẠI: **1 chữ Hán DUY NHẤT nhưng có NHIỀU âm đọc Hán Việt khác nhau, mỗi âm
gắn với 1 nhóm nghĩa/từ ghép riêng** — nếu học sinh chỉ nhớ 1 âm sẽ đọc sai khi gặp từ ghép dùng âm
khác. Đây là hiện tượng 破音字/多音字 trong Hán ngữ học, nhưng khi nhìn qua lăng kính Hán Việt (thay vì
qua Bắc Kinh thoại) lại phong phú hơn hẳn — vì âm Hán Việt bắt nguồn từ nhiều lớp mượn âm khác nhau
qua các thời kỳ lịch sử, không chỉ ánh xạ 1-1 với thanh điệu tiếng Quan thoại hiện đại.

**Ví dụ người dùng đưa ra, đã phân tích kỹ**:

- **行**: 5 âm Hán Việt — **hàng** (hàng/dòng, vd 银行 ngân hàng), **hành** (đi/làm, vd 旅行 lữ hành,
  行动 hành động), **hãng** (hãng/công ty), **hạng** (loại/hạng mục), **hạnh** (phẩm hạnh, vd 品行
  phẩm hạnh, 德行 đức hạnh). Đáng chú ý: tiếng Quan thoại hiện đại 行 chỉ CÒN 2 âm (xíng/háng) —
  nghĩa là 5 âm Hán Việt không ánh xạ gọn gàng 1-1 với 2 âm Quan thoại, mà phản ánh nhiều lớp mượn từ
  Hán cổ khác nhau đã "hóa thạch" riêng trong tiếng Việt qua nhiều thế kỷ, độc lập với biến âm ở
  Trung Quốc.
- **看**: chỉ 2 âm Hán Việt — **khan** (bình thanh, gần 看守 kānshǒu "trông coi") và **khán** (khứ
  thanh, gần 看书 kànshū "xem/đọc") — ánh xạ khá gọn với 2 thanh điệu Quan thoại kān/kàn. Tiếng Nhật
  chỉ có **1** âm on'yomi カン (kan) cho cả 2 nghĩa (tiếng Nhật không giữ phân biệt thanh điệu khi
  mượn âm Hán), cộng thêm âm thuần Nhật kun'yomi 見る (み.る, miru — nghĩa gốc "nhìn", không liên
  quan ngữ âm). Tiếng Hàn cũng chỉ 1 âm 간 (gan), tương tự tiếng Nhật.

**Bài học sư phạm rút ra**: đối chiếu đủ 4 nguồn âm đọc (biến âm Quan thoại + biến âm Hán Việt +
on'yomi/kun'yomi Nhật + âm Hàn) cho CÙNG 1 chữ cho thấy quy luật thú vị — đa âm do THANH ĐIỆU Quan
thoại (như 看) thường RÚT GỌN về 1 âm khi sang Nhật/Hàn (vì 2 ngôn ngữ này không mượn phân biệt thanh
điệu), trong khi đa âm do NHIỀU LỚP MƯỢN TỪ lịch sử (như 行) lại có thể NỞ RỘNG thành nhiều âm Hán
Việt hơn hẳn số âm Quan thoại gốc. Việc học đối chiếu như vậy tạo thêm 1 "móc neo trí nhớ" — gắn từng
âm với 1 cụm từ vựng/nghĩa đặc trưng riêng, tương tự cách 2 trục sound/shape đã làm nhưng theo chiều
ngược (phân hóa nghĩa của 1 chữ, thay vì phân biệt nhiều chữ).

**Trạng thái**: mới dừng ở ý tưởng, CHƯA thiết kế schema hay triển khai. Không khớp thẳng vào cấu
trúc `SoundGroup` hiện tại (vốn dùng cho NHIỀU root khác chữ) — nhiều khả năng cần 1 kiểu dữ liệu mới,
ví dụ `PolyphonicCharacter { character, readings: [{ hanViet, pinyin?, meaningVn, examples[],
onyomi?, kunyomi?, hangeul? }] }`, và nguồn tra cứu chuẩn nên dùng **từ điển Hán Nôm** (theo đúng
nguồn người dùng đối chiếu) thay vì suy đoán — cần nghiên cứu thêm trước khi cam kết cấu trúc dữ
liệu. Ưu tiên sau khi hoàn tất giai đoạn hiện tại (đi vào từng nhóm hình/âm đã có để xây mindmap từ
vựng thật).

**Việc đã làm ngay (không cần đổi schema)**: nhận ra `VocabWord` đã có sẵn field `reading` +
`meaningVn` RIÊNG cho từng từ trong 1 root (không bị ép dùng chung 1 cách đọc của root) — nghĩa là
tính đa âm đã có chỗ để thể hiện mà không cần đổi cấu trúc dữ liệu, chỉ cần đổi CÁCH sinh nội dung.
Đã sửa `src/lib/ai/prompts.ts`: thêm hằng số `POLYPHONY_INSTRUCTION`, chèn vào cả 3 prompt sinh
từ-cho-root (`buildExpandRootPrompt` — nút "✨ Thêm từ" trên mỗi root, `buildNewRootPrompt` — tìm
root mới cho nhóm âm, `buildNewGroupPrompt` — tạo nhóm mới từ 1 từ người dùng nhập) — chỉ thị AI: nếu
chữ gốc đa âm, ưu tiên chọn các từ minh hoạ nhiều cách đọc/nghĩa khác nhau thay vì lặp lại 1 cách đọc,
và mỗi từ phải ghi đúng `reading`/`meaningVn` riêng của chính nó (không rập khuôn theo root). Verify:
tsc + eslint sạch; test qua app thật bằng Playwright — bấm nút "✨ Thêm từ" trên root 骑 (nhóm 奇),
UI vẫn hoạt động bình thường (hiện bước xác nhận Có/Không), không lỗi console. Khi tự tay soạn từ vựng
cho các root (thay vì gọi AI), cũng sẽ áp dụng cùng nguyên tắc này.

### 5. Bắt đầu xây từ vựng thật cho các nhóm khung (words: []) — bắt đầu từ danh mục "Cặp ký tự gần giống"

Sau khi gom 596 nhóm theo 14 danh mục (mục 3), người dùng chọn bắt đầu điền từ vựng thật từ danh mục
**"Cặp ký tự gần giống (hình cận tự)"** — 36 nhóm gốc của cả dự án, đã có từ vựng từ trước (không phải
khung rỗng như phần lớn 560 nhóm hình thanh tự cào tự động sau này).

Rà soát phát hiện: hầu hết mọi root trong 36 nhóm này đã đủ 2 từ, chỉ có **4 root còn thiếu** (1 từ
thay vì 2) — do 4 chữ này quá cổ/hiếm (巳, 曰, 戊, 尸) nên vòng soạn trước chỉ tìm được 1 từ vựng thực
sự thông dụng. Bổ sung từ thứ 2 cho từng root, ưu tiên từ có thật và xác thực được (không đoán):
- **巳** (chi Tị): thêm 上巳节 (Shàngsì Jié — Tết Thượng Tị, lễ hội cổ mùng 3/3 âm lịch).
- **曰** (viết, rằng): thêm 美其名曰 (thành ngữ — lấy danh nghĩa đẹp mà gọi là, hàm ý ngụy biện).
- **戊** (thiên can Mậu): thêm 戊子 (Mậu Tý — tổ hợp can chi khác, dùng đặt tên năm).
- **尸** (thi, xác chết): thêm 尸位素餐 (thành ngữ — giữ chức mà không làm việc).

Kết quả: **toàn bộ danh mục "Cặp ký tự gần giống" (36 nhóm, 84 root) nay đã đủ ≥2 từ/root**. Verify:
dedup id + headword sạch (596 nhóm, 3052 id, không trùng lặp), tsc + eslint sạch, Playwright xác nhận
3 nhóm vừa sửa render đúng, không lỗi console.

**Bước tiếp theo**: tiếp tục điền từ vựng cho 560 nhóm hình thanh tự còn lại (đa số vẫn `words: []`) —
theo thứ tự danh mục do người dùng chọn hoặc Claude đề xuất ở mỗi vòng.

### 6. Rút gọn hiển thị "chung thanh phù" + seed từ vựng cho toàn bộ 1655 root rỗng còn lại

Người dùng yêu cầu 2 việc trong cùng 1 vòng: (1) rút gọn phần hiển thị "(chung thanh phù X)" trong
field `reading` của các nhóm hình thanh tự thành dạng gọn hơn "(XPinyin)" — vd "(青Qíng)"; (2) coi đây
là giai đoạn **tạo seed data**: bổ sung tối thiểu 1 từ cho MỌI root đang hiển thị "0 từ", nhưng KHÔNG
động vào các root/nhóm đã có sẵn từ vựng (dù chỉ 1 từ) — ưu tiên phủ hết bề rộng trước, không đào sâu
thêm ở giai đoạn này.

**Rút gọn hiển thị reading**: viết script quét mọi group có field `reading` dạng "X · Y · Z (chung
thanh phù W)", parse ra thành viên đầu tiên trong danh sách (luôn đúng/không mơ hồ cho riêng nhóm đó,
khác với thanh phù chung — 1 thanh phù có thể có nhiều "nhánh" đọc khác nhau, vd cấu kiện 𠃓 vừa sinh
ra nhánh đọc "chǎng" (场肠畅) vừa sinh nhánh đọc "yáng" (杨扬炀) hoàn toàn không liên quan), tra pinyin
của thành viên đó qua bảng `pinyin.txt` (44435 mục, phủ rộng hơn hanziDB nhiều — cần cho các thanh phù
hiếm không có trong hanziDB), rồi hiển thị dạng gọn "(WPinyin)". Bắt và sửa 3 lỗi phát âm/thanh điệu
ẩn từ trước nhờ đổi cách tính: `zh-shape-chang3` (từng hiện sai "Yáng", đúng ra "Chǎng"), `zh-shape-
ying5` (sai thanh "Yìng" → đúng "Yíng"), `zh-shape-ta1` (sai thanh "Tà" → đúng "Tā"). Thêm bước an
toàn `isAstral()` (mã Unicode > U+FFFF) để không hiển thị trực tiếp glyph hiếm có nguy cơ bị font hệ
thống thay thế nhầm (lặp lại đúng bài học từ vòng cào 596 nhóm) — 4 nhóm không tra được pinyin cho cấu
kiện hiếm (leng4/lian7/quan4/tang7) dùng luôn thành viên đầu làm cả glyph lẫn pinyin hiển thị.

**Seed từ vựng cho 1655 root rỗng**: liệt kê chính xác 1655 root có `words: []` (516 nhóm rỗng hoàn
toàn từ vòng cào tự động), soạn theo lô 200 root/lần (8 lô), mỗi từ gồm headword + pinyin + nghĩa tiếng
Việt + câu ví dụ tiếng Trung + dịch tiếng Việt — ưu tiên từ ghép/thành ngữ CÓ THẬT và quen thuộc; với
các chữ quá hiếm/cổ không có từ ghép hiện đại đáng tin, dùng cách trình bày an toàn: hoặc 1 cụm cổ văn
có nguồn gốc rõ (điển tích, Kinh Thi, Kinh Dịch, Luận Ngữ...) hoặc câu mô tả trung tính "chữ hiếm gặp"
thay vì bịa từ ghép không chắc chắn. Sau mỗi lô: chạy script merge tự động (kiểm tra root còn rỗng +
headword không trùng toàn file trước khi ghi, tự phát hiện & báo lỗi nếu trùng để soạn từ thay thế),
rồi verify dedup id/headword + `tsc --noEmit` + `eslint` + Playwright chụp ảnh vài nhóm mới mỗi lô.

Trong lúc soạn, phát hiện và tự sửa vài trùng lặp headword giữa các lô do nhiều thành viên khác nhau
tình cờ có cùng 1 từ ghép phổ biến nhất (ví dụ 螳螂 vừa là headword tự nhiên của root 螂 lại vừa của
root 螳 — 2 root khác nhau trong 2 nhóm khác nhau cùng dùng chung 1 từ quen thuộc nhất) — xử lý bằng
cách đổi 1 trong 2 sang từ/thành ngữ mở rộng chứa cùng chữ (vd 螳螂 → 螳螂捕蝉).

Kết quả cuối: **596 nhóm, 4707 id, 2180 từ vựng, 0 root rỗng — không trùng id, không trùng headword**.
Tiện thể phát hiện thêm 1 lỗi phụ: field `note` của 516 nhóm từng cào tự động vẫn còn câu "(Nhóm khung
— chưa có từ vựng...)" viết cứng từ giai đoạn tạo khung — nay đã sai vì mọi nhóm đều có từ, nên đã viết
script gỡ bỏ câu này khỏi toàn bộ 516 `note` (đúng nghĩa: chỉ cắt phần hậu tố lỗi thời, giữ nguyên phần
mô tả cấu kiện/thanh phù phía trước). tsc + eslint sạch xuyên suốt cả 8 lô; Playwright xác nhận nhiều
nhóm mẫu (bao gồm nhóm chữ hiếm 侯/煌/璃) hiển thị đúng, không lỗi console, và không còn ghi chú lỗi
thời sau khi sửa.

**Bước tiếp theo**: với seed data đã phủ đầy đủ bề rộng (mọi root ≥1 từ), có thể bắt đầu đào sâu thêm
2 từ/root cho các nhóm quan trọng/thông dụng, hoặc quay lại ý tưởng trục đa âm Hán Việt (mục 4) khi đã
sẵn sàng, tùy người dùng chọn hướng tiếp theo.

### 7. Thêm thống kê số từ theo danh mục + mở rộng 553 nhóm mỏng (2-6 từ) lên ≥7 từ/nhóm

Người dùng nhận xét trang tổng quan (mục 3) chỉ hiện số lượng NHÓM theo từng danh mục, không hiện tổng
số TỪ VỰNG — kiểm tra code xác nhận đúng: card từng nhóm đã có "X chữ · Y từ" nhưng thanh điều hướng
danh mục và tiêu đề mỗi danh mục chỉ có "(N nhóm)". Đã sửa `src/app/shapes/[lang]/page.tsx`: cộng dồn
`wordCount(g)` qua mọi nhóm trong 1 danh mục, hiện cả ở nav chip ("Cặp ký tự gần giống (36 nhóm · 253
từ)") lẫn tiêu đề `<summary>` mỗi danh mục khi mở rộng.

Sau khi có số liệu thật (2184 từ / 596 nhóm), phát hiện **553/596 nhóm chỉ có 2-6 từ** (mỗi root vừa
seed đúng 1 từ ở vòng trước) — nghĩa là "đào sâu 2 từ/root cho nhóm quan trọng" (đề xuất ban đầu) và
"nâng nhóm 2-6 từ lên ≥7 từ" gần như là CÙNG một tập việc, nên gộp làm 1 đợt duy nhất thay vì tách 2
bước. Người dùng xác nhận phạm vi: áp dụng cho toàn bộ 553 nhóm (không chỉ nhóm thông dụng).

**Phương pháp**: với mỗi nhóm <7 từ, tính số từ còn thiếu = 7 − tổng hiện tại, chia đều (round-robin)
cho các root trong nhóm để xác định mỗi root cần thêm bao nhiêu từ. Viết script merge mới
(`apply_expand_batch.js`) — khác script seed ban đầu ở chỗ: cho phép root ĐÃ có từ vẫn nhận thêm từ mới
(id tự tăng `-w2`, `-w3`...), vẫn giữ nguyên tắc chống trùng headword toàn file. Soạn 8 lô ~150-200 mục/
lô, mỗi lô: tính lại danh sách còn thiếu từ trạng thái file HIỆN TẠI (không dùng danh sách cũ đã lỗi
thời), soạn từ mới ưu tiên từ ghép/thành ngữ phổ biến thật; với các chữ đã dùng hết mọi từ ghép hiện đại
đáng tin ở vòng seed trước (bound morpheme — chỉ tồn tại trong đúng 1 từ ghép cố định), dùng cách trình
bày an toàn nhất quán: ghi chú "chữ hiếm khi dùng riêng lẻ (chỉ có trong X)" thay vì bịa từ ghép thứ 2
không có thật.

Trong lúc soạn phát hiện thêm một lớp lỗi mới: nhiều root RẤT hiếm (như 钔, 钐, 銧, 蠏, 辁...) đã tự dùng
CHÍNH KÝ TỰ làm headword duy nhất ở vòng seed trước — khi cố thêm "từ thứ 2" cho các root này, script
báo trùng vì vô tình gõ lại y hệt headword cũ. Với các trường hợp còn cứu được, đổi sang cụm mở rộng có
ngữ cảnh thật (vd "锘" riêng lẻ → "锘元素"; "琏" riêng lẻ → "瑚琏" điển cố Luận Ngữ); với khoảng 15-20
root cực hiếm không tìm được cụm thay thế đáng tin (như 钔, 钐, 銧, 鞧...), chấp nhận để root đó thiếu 1
từ so với mục tiêu 7 — ưu tiên KHÔNG bịa từ hơn là đạt đúng số 7 cho mọi nhóm.

Kết quả sau 8 lô: **596 nhóm, ~6267 id, 3740 từ vựng** (tăng từ 2184 → 3740, +1556 từ trong vòng này).
**484/596 nhóm (81%) đã đạt ≥7 từ** — 112 nhóm còn <7 từ, hầu hết là các nhóm chữ cực hiếm/cổ văn nơi
vốn từ ghép hiện đại thật sự đã cạn (không phải do bỏ dở). tsc + eslint sạch xuyên suốt cả 8 lô;
Playwright xác nhận nhiều nhóm mẫu — kể cả nhóm 2-root cần 3-4 từ/root (财·材, 城·诚, 怀·坏) và nhóm chữ
hiếm (獾/驩/讙) — render đúng, không lỗi console, tổng số từ hiện đúng ở mọi cấp (chip danh mục, tiêu đề
danh mục, card từng nhóm).

**Trạng thái dừng**: 112 nhóm còn <7 từ là điểm dừng hợp lý cho vòng này — phần lớn là các cụm cấu kiện
âm cổ/hiếm (danh mục "Cấu kiện âm cổ / hiếm gặp") nơi việc ép đủ 7 từ/nhóm sẽ buộc phải bịa từ ghép
không có thật, đi ngược nguyên tắc chất lượng đã giữ xuyên suốt dự án. Có thể tiếp tục nếu muốn rà tay
từng nhóm còn lại để tìm thêm từ ghép hiếm nhưng có thật (tốn công hơn hẳn, lợi suất giảm dần).

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
