#!/usr/bin/env node
// Gộp dữ liệu từ nối (soạn theo từng phần) thành data/zh-connectors.json và data/ko-connectors.json.
// Dùng: node scripts/build-connectors.mjs <thư-mục-chứa zh1.json zh2.json ko1.json ko2.json>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("Thiếu thư mục nguồn");
  process.exit(1);
}

const CATEGORIES = [
  { id: "add", titleVn: "Thêm ý — và, cũng, ngoài ra, hơn nữa", icon: "➕" },
  { id: "choice", titleVn: "Lựa chọn — hoặc, hay là, thà", icon: "🔀" },
  { id: "contrast", titleVn: "Tương phản — nhưng, tuy, dù", icon: "↔️" },
  { id: "cause", titleVn: "Nguyên nhân — vì, do, bởi vì", icon: "❓" },
  { id: "result", titleVn: "Kết quả — vì vậy, cho nên, do đó", icon: "➡️" },
  { id: "condition", titleVn: "Điều kiện & thời gian — nếu, chỉ cần, khi", icon: "🔑" },
  { id: "example", titleVn: "Ví dụ & giải thích — ví dụ, tức là, thật ra", icon: "💡" },
  { id: "sequence", titleVn: "Trình tự — trước hết, sau đó, cuối cùng", icon: "🔢" },
  { id: "purpose", titleVn: "Mục đích — để, nhằm, để khỏi", icon: "🎯" },
  { id: "summary", titleVn: "Tổng kết — tóm lại, dù sao, rốt cuộc", icon: "📌" },
  { id: "progression", titleVn: "Tăng tiến — không những, thậm chí, càng…càng", icon: "📈" },
  { id: "transition", titleVn: "Chuyển ý — còn về, nhân tiện, thì ra", icon: "🔄" },
];

const RENAME = {
  "zh-cong'er": "zh-conger",
  "ko-neunbaramе": "ko-neun-barame",
  "ko-ani-ramyeon": "ko-geureochi-aneumyeon",
  "ko-gatabyeon": "ko-garyeong",
  "ko-gatchi": "ko-cheoreom",
  "ko-nunggeumi": "ko-majimageuro",
  "ko-nihayeon": "ko-deudieo",
  "ko-eolmana": "ko-jeomjeom",
  "ko-jinjja": "ko-deouk",
  "ko-geureom-geurigo": "ko-geugeon-geureoko",
  "ko-geunde-talk": "ko-cham",
  "ko-dahaeng": "ko-daman",
  "ko-ireohge": "ko-geunajeona",
  "ko-sasang": "ko-soljikhi",
  "ko-ape": "ko-daeumeuro",
  "ko-geurigo-naseo": "ko-geureogo-naseo",
  "ko-gerok": "ko-ge",
};

const PATCH = {
  "zh-danshi": {
    mnemonicVn: "但是 ĐÃN THỊ — 但 = 亻(người) + 旦 (bình minh): người ta tưởng thế, NHƯNG sáng ra lại khác. Thông dụng nhất, nói hay viết đều được.",
  },
  "ko-deouk": { form: "더욱" },
  "ko-gyeolguk-sum": { hanja: "結局__" },
  "ko-hokeun": { hanja: "或_" },
  "ko-banmyeone": { hanja: "反面_" },
  "ko-gyeolguk": { hanja: "結局" },
  "ko-geu-gyeolgwa": { hanja: "_結果" },
  "ko-useon": { hanja: "于先" },
};

const CONFUSIONS = {
  zh: [
    {
      id: "zh-cf-or",
      titleVn: "或者 vs 还是 — \"hoặc\" hay \"hay là\"?",
      entryIds: ["zh-huozhe", "zh-haishi"],
      explanationVn: "Câu KỂ → 或者 (你明天或者后天来都行). Câu HỎI lựa chọn → 还是 (你喝茶还是喝咖啡？). Sau 不知道/不管/无论 cũng dùng 还是.",
    },
    {
      id: "zh-cf-only",
      titleVn: "只要…就 vs 只有…才",
      entryIds: ["zh-zhiyao", "zh-zhiyou"],
      explanationVn: "只要…就 = chỉ CẦN (điều kiện đủ, dễ): 只要努力就能进步. 只有…才 = chỉ CÓ… MỚI (điều kiện bắt buộc, khó): 只有努力才能成功. Đừng ghép chéo 只要…才 / 只有…就.",
    },
    {
      id: "zh-cf-but",
      titleVn: "但是 / 可是 / 不过 / 然而 / 却",
      entryIds: ["zh-danshi", "zh-keshi", "zh-buguo", "zh-raner", "zh-que"],
      explanationVn: "但是: chuẩn mực. 可是: khẩu ngữ, giọng tiếc nuối. 不过: nhẹ, \"có điều\". 然而: văn viết. 却: PHÓ TỪ, đứng sau chủ ngữ (他却不来), có thể đi cùng 但是.",
    },
    {
      id: "zh-cf-although",
      titleVn: "虽然 vs 即使 vs 尽管",
      entryIds: ["zh-suiran", "zh-jishi", "zh-jinguan", "zh-napa"],
      explanationVn: "虽然/尽管 + SỰ THẬT (đã xảy ra) … 但是. 即使/哪怕 + GIẢ ĐỊNH (chưa chắc xảy ra) … 也.",
    },
    {
      id: "zh-cf-because",
      titleVn: "因为 / 由于 / 既然",
      entryIds: ["zh-yinwei", "zh-youyu", "zh-jiran"],
      explanationVn: "因为: thường ngày, đi với 所以. 由于: văn viết, đi với 因此. 既然: lý do người nghe ĐÃ BIẾT, vế sau là đề nghị/kết luận với 就.",
    },
    {
      id: "zh-cf-so",
      titleVn: "所以 / 因此 / 于是 / 结果",
      entryIds: ["zh-suoyi", "zh-yinci", "zh-yushi", "zh-jieguo"],
      explanationVn: "所以: khẩu ngữ. 因此: văn viết. 于是: KỂ CHUYỆN, hành động nối tiếp (他饿了，于是去吃饭). 结果: kết cục (thường ngoài ý muốn).",
    },
    {
      id: "zh-cf-and",
      titleVn: "和 vs 而且 / 并且 / 还",
      entryIds: ["zh-he", "zh-erqie", "zh-bingqie", "zh-hai"],
      explanationVn: "和 CHỈ nối danh từ. Nối động từ/câu: 而且 (thêm ý mạnh hơn), 并且 (hai hành động song song, trang trọng), 还 (đặt trước động từ thứ hai).",
    },
    {
      id: "zh-cf-later",
      titleVn: "后来 vs 以后 vs 然后",
      entryIds: ["zh-houlai", "zh-ranhou", "zh-jiezhe"],
      explanationVn: "后来: chỉ QUÁ KHỨ, đứng một mình (后来他走了). 以后: quá khứ lẫn tương lai, có thể đi sau mốc (三天以后). 然后: bước tiếp theo trong chuỗi hành động.",
    },
    {
      id: "zh-cf-prefer",
      titleVn: "与其…不如 vs 宁可…也不",
      entryIds: ["zh-yuqi-buru", "zh-ningke"],
      explanationVn: "与其 A 不如 B → chọn B (vế SAU). 宁可 A 也不 B → chọn A (vế ĐẦU), dù A thiệt thòi.",
    },
    {
      id: "zh-cf-otherwise",
      titleVn: "否则 vs 不然 / 要不然",
      entryIds: ["zh-fouze", "zh-buran"],
      explanationVn: "Cùng nghĩa \"nếu không thì\". 否则: văn viết. 不然/要不然: khẩu ngữ; 要不 còn dùng để gợi ý (要不我们走吧).",
    },
    {
      id: "zh-cf-example",
      titleVn: "比如 / 例如 / 譬如 / 像",
      entryIds: ["zh-biru", "zh-liru", "zh-piru", "zh-xiang"],
      explanationVn: "比如: khẩu ngữ. 例如: văn viết, liệt kê. 譬如: văn viết, ví von. 像: \"như là\", đứng trước danh từ (像苹果、香蕉…).",
    },
    {
      id: "zh-cf-both",
      titleVn: "一边…一边 vs 既…又",
      entryIds: ["zh-yibian", "zh-jiyou"],
      explanationVn: "一边…一边: hai HÀNH ĐỘNG cùng lúc (一边吃饭一边看电视). 既…又: hai TÍNH CHẤT cùng có (既便宜又好吃).",
    },
    {
      id: "zh-cf-purpose",
      titleVn: "为了 / 以便 / 以免",
      entryIds: ["zh-weile", "zh-yibian2", "zh-yimian"],
      explanationVn: "为了 + mục đích đứng ĐẦU câu. 以便 + mục đích ở vế SAU (để tiện…). 以免/免得 = để TRÁNH điều xấu.",
    },
    {
      id: "zh-cf-anyway",
      titleVn: "总之 / 反正 / 毕竟",
      entryIds: ["zh-zongzhi", "zh-fanzheng", "zh-bijing"],
      explanationVn: "总之: tổng kết. 反正: \"dù sao thì\" — kết quả không đổi dù điều kiện thế nào. 毕竟: \"xét cho cùng\" — nêu lý do cốt lõi để thông cảm.",
    },
    {
      id: "zh-cf-even",
      titleVn: "不但…而且 / 甚至 / 何况",
      entryIds: ["zh-budan", "zh-bujin", "zh-shenzhi", "zh-hekuang"],
      explanationVn: "不但/不仅…而且: thêm ý ngang hoặc mạnh hơn. 甚至: đẩy tới mức cực đoan. 何况: câu hỏi tu từ \"huống chi\" (cái khó còn làm được, huống chi cái dễ).",
    },
  ],
  ko: [
    {
      id: "ko-cf-or",
      titleVn: "또는 / 혹은 / 아니면 / -거나",
      entryIds: ["ko-ttoneun", "ko-hokeun", "ko-animyeon", "ko-geona"],
      explanationVn: "또는/혹은: nối DANH TỪ trong câu kể, văn viết. 아니면: câu HỎI lựa chọn, khẩu ngữ (giống 还是). -거나: đuôi gắn vào ĐỘNG/TÍNH TỪ.",
    },
    {
      id: "ko-cf-because",
      titleVn: "-아서 vs -(으)니까 vs -기 때문에",
      entryIds: ["ko-aseo", "ko-eunikka", "ko-gittaemune", "ko-neun-barame"],
      explanationVn: "-아서: lý do tự nhiên, KHÔNG đi với mệnh lệnh/rủ rê, không chia quá khứ. -(으)니까: lý do chủ quan, ĐI ĐƯỢC với mệnh lệnh. -기 때문에: nhấn mạnh, chia được quá khứ. -는 바람에: sự cố bất ngờ → kết quả xấu.",
    },
    {
      id: "ko-cf-so",
      titleVn: "그래서 vs 그러니까 vs 따라서",
      entryIds: ["ko-geuraeseo", "ko-geureonikka", "ko-ttaraseo", "ko-geureomeuro"],
      explanationVn: "그래서: kể kết quả, không đi với lệnh. 그러니까: kèm lời khuyên/lệnh hoặc \"ý tôi là\". 따라서/그러므로: văn viết, lập luận.",
    },
    {
      id: "ko-cf-but",
      titleVn: "하지만 / 그러나 / 그렇지만 / 그런데",
      entryIds: ["ko-hajiman", "ko-geureona", "ko-geureojiman", "ko-geureonde"],
      explanationVn: "하지만: chuẩn mực. 그러나: văn viết. 그렇지만: \"đúng vậy nhưng\". 그런데: tương phản nhẹ HOẶC chuyển chủ đề \"mà này\".",
    },
    {
      id: "ko-cf-jiman",
      titleVn: "-지만 vs -는데",
      entryIds: ["ko-jiman", "ko-neunde"],
      explanationVn: "-지만: tương phản rõ ràng. -는데: nêu BỐI CẢNH rồi nói tiếp — có thể tương phản nhẹ hoặc chỉ dẫn dắt (비가 오는데 우산 있어요?).",
    },
    {
      id: "ko-cf-even-if",
      titleVn: "-아도 / -더라도 / 그래도",
      entryIds: ["ko-ado", "ko-deorado", "ko-geuraedo"],
      explanationVn: "-아도: dù (thực tế lẫn giả định). -더라도: giả định mạnh hơn \"cho dù… đi nữa\". 그래도: đứng đầu câu \"dù vậy vẫn\".",
    },
    {
      id: "ko-cf-finally",
      titleVn: "결국 vs 드디어",
      entryIds: ["ko-gyeolguk", "ko-deudieo"],
      explanationVn: "드디어: điều MONG ĐỢI cuối cùng đã tới (终于). 결국: kết cục sau quá trình, thường không như ý.",
    },
    {
      id: "ko-cf-purpose",
      titleVn: "-(으)려고 / -(으)러 / -기 위해 / -도록",
      entryIds: ["ko-euryeogo", "ko-eureo", "ko-gi-wihae", "ko-dorok"],
      explanationVn: "-(으)러: CHỈ trước 가다/오다. -(으)려고: ý định, không đi với lệnh. -기 위해: trang trọng, dùng được với lệnh. -도록: để cho (người/sự việc) đạt trạng thái.",
    },
    {
      id: "ko-cf-if",
      titleVn: "-(으)면 vs -다면 vs 만약",
      entryIds: ["ko-eumyeon", "ko-damyeon", "ko-manyage"],
      explanationVn: "-(으)면: điều kiện thường. -다면: giả định ít khả năng. 만약: trạng từ đầu câu nhấn mạnh, vẫn phải đi với -(으)면/-다면.",
    },
    {
      id: "ko-cf-and",
      titleVn: "그리고 / 또한 / 게다가 / 더구나",
      entryIds: ["ko-geurigo", "ko-ttohan", "ko-gedaga", "ko-deoguna"],
      explanationVn: "그리고: \"và\" trung tính. 또한: văn viết. 게다가/더구나: chồng thêm ý cùng chiều, làm tình hình mạnh hơn.",
    },
    {
      id: "ko-cf-even",
      titleVn: "심지어 / -까지 / -조차",
      entryIds: ["ko-simjieo", "ko-kkaji"],
      explanationVn: "심지어: trạng từ \"thậm chí\". -까지: \"cả cái đó nữa\" (cộng thêm). -조차: \"ngay cả… cũng không\" (thường với phủ định).",
    },
    {
      id: "ko-cf-anyway",
      titleVn: "아무튼 / 요컨대 / 한마디로",
      entryIds: ["ko-amuteun", "ko-yokeondae", "ko-hanmadiro"],
      explanationVn: "아무튼/어쨌든: khẩu ngữ \"dù sao thì\". 요컨대: văn viết \"tóm lại\". 한마디로: \"nói gọn một câu\".",
    },
  ],
};

function load(name) {
  return JSON.parse(readFileSync(join(dir, name), "utf8"));
}

function build(lang, files) {
  const raw = files.flatMap(load);
  const seen = new Set();
  const entries = raw.map((e) => {
    const id = RENAME[e.id] ?? e.id;
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`id không hợp lệ: ${id}`);
    if (seen.has(id)) throw new Error(`id trùng: ${id}`);
    seen.add(id);
    const out = { ...e, id, ...PATCH[id] };
    for (const ex of out.examples) {
      if (!ex.sentence.includes(ex.answer)) throw new Error(`${id}: câu không chứa "${ex.answer}"`);
    }
    return out;
  });
  for (const id of Object.keys(PATCH)) {
    if (id.startsWith(lang) && !seen.has(id)) throw new Error(`PATCH trỏ tới id không có: ${id}`);
  }
  const categories = CATEGORIES.map((c) => ({
    ...c,
    entries: entries
      .filter((e) => e.cat === c.id)
      // eslint-disable-next-line no-unused-vars
      .map(({ cat, ...rest }) => rest),
  }));
  const unknown = entries.filter((e) => !CATEGORIES.some((c) => c.id === e.cat));
  if (unknown.length) throw new Error(`nhóm lạ: ${unknown.map((e) => e.id)}`);
  const confusions = CONFUSIONS[lang];
  for (const cf of confusions) {
    for (const id of cf.entryIds) if (!seen.has(id)) throw new Error(`${cf.id}: không có ${id}`);
  }
  const out = { language: lang, categories, confusions };
  writeFileSync(`data/${lang}-connectors.json`, JSON.stringify(out, null, 2) + "\n");
  console.log(`${lang}: ${entries.length} từ nối, ${confusions.length} cụm dễ nhầm`);
}

build("zh", ["zh1.json", "zh2.json"]);
build("ko", ["ko1.json", "ko2.json"]);
