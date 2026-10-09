import "server-only";
import type { GroupKind, Language, LanguageData, RootEntry, SoundGroup, VocabWord } from "@/types/vocab";
import { kvGet, kvSet } from "@/lib/kv";
import { genId } from "@/lib/id";
import { getMnemonicMap } from "@/lib/mnemonicStore";
import { flattenWords } from "@/lib/wordTree";
import { pinyinToneKey } from "@/lib/zhPinyin";
import zh from "../../data/zh.json";
import ko from "../../data/ko.json";
import ja from "../../data/ja.json";
import en from "../../data/en.json";
import es from "../../data/es.json";
import zhShape from "../../data/zh-shape.json";
import jaShape from "../../data/ja-shape.json";
import koShape from "../../data/ko-shape.json";
import zhFalseFriends from "../../data/zh-false-friends.json";
import jaFalseFriends from "../../data/ja-false-friends.json";
import koFalseFriends from "../../data/ko-false-friends.json";
import zhInitials from "../../data/zh-initials.json";
import enShape from "../../data/en-shape.json";
import esShape from "../../data/es-shape.json";

const STATIC_DATA: Record<Language, LanguageData> = {
  zh: zh as LanguageData,
  ko: ko as LanguageData,
  ja: ja as LanguageData,
  // Tiếng Anh dùng LẠI đúng pool "sound" hiện có, không tạo groupKind/route riêng — mỗi group là 1
  // "họ từ" (word family) theo gốc Latin/Hy Lạp thay vì chữ Hán đồng âm. Xem Features.md mục 15.
  en: en as LanguageData,
  // Tiếng Tây Ban Nha: cùng cách tái diễn giải như tiếng Anh, nhưng ở đây là họ từ GỐC LATIN THẬT SỰ
  // (tiếng Tây Ban Nha là ngôn ngữ Roman trực hệ từ Latin) — vd tener/mantener/sostener/obtener.
  es: es as LanguageData,
};

// Dữ liệu "nhóm hình" (chữ VIẾT giống nhau, hình cận tự) — trục nhầm lẫn song song với nhóm âm ở
// trên, chỉ khai báo cho ngôn ngữ nào đã có dữ liệu.
const STATIC_SHAPE_DATA: Partial<Record<Language, LanguageData>> = {
  zh: zhShape as LanguageData,
  ja: jaShape as LanguageData,
  // Tiếng Hàn hiện đại viết bằng Hangul (dễ phân biệt hơn chữ Hán/Kanji nhiều), nhưng từ vựng Hán-Hàn
  // vẫn có GỐC HÁN TỰ — trục "hình cận tự" ở đây tái dùng đúng cặp chữ Hán dễ nhầm hình dạng như zh/ja,
  // rồi tìm từ Hán-Hàn thật (viết bằng Hangul) tương ứng với từng chữ gốc. Xem readme.md mục ý tưởng #2.
  ko: koShape as LanguageData,
  // Tiếng Anh: "hình cận tự" reinterpreted thành "từ suýt giống nhau về chính tả" (desert/dessert,
  // affect/effect...) — cùng tinh thần nhầm lẫn thị giác nhưng qua chữ cái thay vì nét chữ Hán.
  en: enShape as LanguageData,
  // Tiếng Tây Ban Nha: "từ dễ nhầm lẫn" ở đây chủ yếu là các cặp đồng âm phân biệt bằng DẤU TRỌNG ÂM
  // (tú/tu, sí/si...) hoặc lẫn lộn B/V-C/S kinh điển (botar/votar, cocer/coser).
  es: esShape as LanguageData,
};

// Dữ liệu "bẫy nghĩa" (1 chữ dùng chung giữa 2+ từ ghép nhưng nghĩa lệch/trôi nhau) — trục nhầm lẫn
// thứ ba. zh có 1002 nhóm (soạn từ lâu); ja/ko bắt đầu từ batch 1 (12 nhóm/24 từ mỗi ngôn ngữ) —
// hiện tượng này áp dụng tốt cho cả 2 ngôn ngữ vì từ Hán-Nhật (on'yomi)/Hán-Hàn (한자어) cũng có chung
// đặc điểm 1 chữ Hán/Hanja trôi nghĩa khác nhau giữa các từ ghép, y hệt tiếng Trung/Hán-Việt.
const STATIC_FALSE_FRIEND_DATA: Partial<Record<Language, LanguageData>> = {
  zh: zhFalseFriends as LanguageData,
  ja: jaFalseFriends as LanguageData,
  ko: koFalseFriends as LanguageData,
};

// Dữ liệu "cùng âm đầu pinyin" (chỉ trùng phụ âm đầu, không liên quan âm/nghĩa) — trục nhầm lẫn thứ
// tư, hiện chỉ có cho tiếng Trung (ja/ko chưa viết).
const STATIC_INITIAL_DATA: Partial<Record<Language, LanguageData>> = {
  zh: zhInitials as LanguageData,
};

const ALL_LANGUAGES: Language[] = ["zh", "ko", "ja", "en", "es"];

interface DynamicAdditions {
  extraWords: Record<string, VocabWord[]>;
  extraRoots: Record<string, RootEntry[]>;
  wordChildren: Record<string, VocabWord[]>;
  /** Nhóm âm hoàn toàn mới do người dùng gõ 1 từ trên trang ngôn ngữ chung rồi AI tạo mindmap
   * (xem addExtraGroup) — khác với extraRoots (thêm chữ gốc vào nhóm CÓ SẴN). */
  extraGroups: SoundGroup[];
}

function emptyAdditions(): DynamicAdditions {
  return { extraWords: {}, extraRoots: {}, wordChildren: {}, extraGroups: [] };
}

function kvKey(lang: Language): string {
  return `vocab:extra:${lang}`;
}

async function loadAdditions(lang: Language): Promise<DynamicAdditions> {
  try {
    const data = await kvGet<Partial<DynamicAdditions>>(kvKey(lang));
    return {
      extraWords: data?.extraWords ?? {},
      extraRoots: data?.extraRoots ?? {},
      wordChildren: data?.wordChildren ?? {},
      extraGroups: data?.extraGroups ?? [],
    };
  } catch {
    // KV chưa cấu hình (vd. chạy local chưa có Upstash) — dùng dữ liệu tĩnh, bỏ qua phần mở rộng.
    return emptyAdditions();
  }
}

/** Đóng dấu "do người học tự thêm" lên 1 từ và toàn bộ con cháu của nó. Xem `ContentSource`: dấu này
 * KHÔNG nằm trong KV, nó được gắn ở đây vì mọi thứ lấy ra từ `additions` theo định nghĩa đã là của
 * người dùng — nhờ vậy dữ liệu cũ không cần sửa và cờ không bao giờ lệch với thực tế. */
function markUserWord(word: VocabWord): VocabWord {
  return {
    ...word,
    source: "user",
    ...(word.children ? { children: word.children.map(markUserWord) } : {}),
  };
}

function markUserRoot(root: RootEntry): RootEntry {
  return { ...root, source: "user", words: root.words.map(markUserWord) };
}

/** Recursively attaches AI-generated child branches (from `wordChildren`) onto a word and
 * all of its existing descendants, so a child can itself later be expanded further. */
function attachWordChildren(word: VocabWord, wordChildren: Record<string, VocabWord[]>): VocabWord {
  const ownChildren = (word.children ?? []).map((c) => attachWordChildren(c, wordChildren));
  // Nhánh con lấy từ `wordChildren` là do người học bấm "mở rộng" mà có → đánh dấu luôn.
  const addedChildren = (wordChildren[word.id] ?? []).map((c) =>
    markUserWord(attachWordChildren(c, wordChildren)),
  );
  const allChildren = [...ownChildren, ...addedChildren];
  return allChildren.length > 0 ? { ...word, children: allChildren } : word;
}

function mergeGroup(group: SoundGroup, additions: DynamicAdditions): SoundGroup {
  const roots = group.roots.map((root) => {
    const extra = (additions.extraWords[root.id] ?? []).map(markUserWord);
    const words = extra.length > 0 ? [...root.words, ...extra] : root.words;
    return { ...root, words: words.map((w) => attachWordChildren(w, additions.wordChildren)) };
  });
  const extraRoots = (additions.extraRoots[group.id] ?? []).map((root) => {
    const marked = markUserRoot(root);
    return { ...marked, words: marked.words.map((w) => attachWordChildren(w, additions.wordChildren)) };
  });
  return { ...group, roots: [...roots, ...extraRoots] };
}

/** Nhóm do người học tự tạo (qua AI hoặc tự nhập): đóng dấu cả nhóm lẫn mọi chữ gốc/từ bên trong. */
function markUserGroup(group: SoundGroup): SoundGroup {
  return { ...group, source: "user", roots: group.roots.map(markUserRoot) };
}

function applyMnemonicToWord(word: VocabWord, mnemonics: Record<string, string>): VocabWord {
  const withChildren = word.children
    ? { ...word, children: word.children.map((c) => applyMnemonicToWord(c, mnemonics)) }
    : word;
  return mnemonics[word.id] ? { ...withChildren, mnemonicVn: mnemonics[word.id] } : withChildren;
}

function applyMnemonics(group: SoundGroup, mnemonics: Record<string, string>): SoundGroup {
  if (Object.keys(mnemonics).length === 0) return group;
  return {
    ...group,
    roots: group.roots.map((root) => ({
      ...root,
      words: root.words.map((w) => applyMnemonicToWord(w, mnemonics)),
    })),
  };
}

export async function getLanguageData(lang: string): Promise<LanguageData | undefined> {
  const staticData = STATIC_DATA[lang as Language];
  if (!staticData) return undefined;
  const [additions, mnemonics] = await Promise.all([
    loadAdditions(lang as Language),
    getMnemonicMap(lang as Language),
  ]);
  const staticGroups = staticData.groups.map((g) => applyMnemonics(mergeGroup(g, additions), mnemonics));
  const newGroups = additions.extraGroups.map((g) =>
    applyMnemonics(mergeGroup(markUserGroup(g), additions), mnemonics),
  );
  return {
    ...staticData,
    groups: [...staticGroups, ...newGroups],
  };
}

export async function getLanguages(): Promise<LanguageData[]> {
  const results = await Promise.all(ALL_LANGUAGES.map((l) => getLanguageData(l)));
  return results.filter((d): d is LanguageData => !!d);
}

export async function getSoundGroup(lang: string, groupId: string): Promise<SoundGroup | undefined> {
  const data = await getLanguageData(lang);
  return data?.groups.find((g) => g.id === groupId);
}

/** Tương tự getLanguageData nhưng đọc từ dữ liệu "nhóm hình" (groupKind: "shape"). Dùng chung
 * loadAdditions/mergeGroup/applyMnemonics vì rootId/groupId của nhóm hình đã có tiền tố "-shape-"
 * riêng, không đụng namespace với nhóm âm trong cùng 1 KV bucket theo ngôn ngữ. */
export async function getShapeLanguageData(lang: string): Promise<LanguageData | undefined> {
  const staticData = STATIC_SHAPE_DATA[lang as Language];
  if (!staticData) return undefined;
  const [additions, mnemonics] = await Promise.all([
    loadAdditions(lang as Language),
    getMnemonicMap(lang as Language),
  ]);
  return {
    ...staticData,
    groups: staticData.groups.map((g) => applyMnemonics(mergeGroup(g, additions), mnemonics)),
  };
}

export async function getShapeLanguages(): Promise<LanguageData[]> {
  const results = await Promise.all(ALL_LANGUAGES.map((l) => getShapeLanguageData(l)));
  return results.filter((d): d is LanguageData => !!d);
}

export async function getShapeGroup(lang: string, groupId: string): Promise<SoundGroup | undefined> {
  const data = await getShapeLanguageData(lang);
  return data?.groups.find((g) => g.id === groupId);
}

/** Tương tự getLanguageData nhưng đọc từ dữ liệu "bẫy nghĩa" (groupKind: "false-friend"). Dùng chung
 * loadAdditions/mergeGroup/applyMnemonics vì rootId/groupId của nhóm bẫy nghĩa đã có tiền tố "-ff-"
 * riêng, không đụng namespace với nhóm âm/nhóm hình trong cùng 1 KV bucket theo ngôn ngữ. */
export async function getFalseFriendLanguageData(lang: string): Promise<LanguageData | undefined> {
  const staticData = STATIC_FALSE_FRIEND_DATA[lang as Language];
  if (!staticData) return undefined;
  const [additions, mnemonics] = await Promise.all([
    loadAdditions(lang as Language),
    getMnemonicMap(lang as Language),
  ]);
  return {
    ...staticData,
    groups: staticData.groups.map((g) => applyMnemonics(mergeGroup(g, additions), mnemonics)),
  };
}

export async function getFalseFriendLanguages(): Promise<LanguageData[]> {
  const results = await Promise.all(ALL_LANGUAGES.map((l) => getFalseFriendLanguageData(l)));
  return results.filter((d): d is LanguageData => !!d);
}

export async function getFalseFriendGroup(lang: string, groupId: string): Promise<SoundGroup | undefined> {
  const data = await getFalseFriendLanguageData(lang);
  return data?.groups.find((g) => g.id === groupId);
}

/** Tương tự getLanguageData nhưng đọc từ dữ liệu "cùng âm đầu pinyin" (groupKind: "initial"). Dùng
 * chung loadAdditions/mergeGroup/applyMnemonics vì rootId/groupId của nhóm âm đầu đã có tiền tố
 * "-init-" riêng, không đụng namespace với các trục nhầm lẫn khác trong cùng 1 KV bucket theo ngôn ngữ. */
export async function getInitialLanguageData(lang: string): Promise<LanguageData | undefined> {
  const staticData = STATIC_INITIAL_DATA[lang as Language];
  if (!staticData) return undefined;
  const [additions, mnemonics] = await Promise.all([
    loadAdditions(lang as Language),
    getMnemonicMap(lang as Language),
  ]);
  return {
    ...staticData,
    groups: staticData.groups.map((g) => applyMnemonics(mergeGroup(g, additions), mnemonics)),
  };
}

export async function getInitialLanguages(): Promise<LanguageData[]> {
  const results = await Promise.all(ALL_LANGUAGES.map((l) => getInitialLanguageData(l)));
  return results.filter((d): d is LanguageData => !!d);
}

export async function getInitialGroup(lang: string, groupId: string): Promise<SoundGroup | undefined> {
  const data = await getInitialLanguageData(lang);
  return data?.groups.find((g) => g.id === groupId);
}

/** Tra 1 group theo ĐÚNG trục nhầm lẫn (groupKind) của nó — dùng cho favorite/danh mục cá nhân
 * (xem personal.ts), vì 1 groupId chỉ có ý nghĩa khi biết nó thuộc pool sound/shape/false-friend/
 * initial nào (4 pool này không dùng chung namespace ID). */
export async function getGroupByKind(
  lang: string,
  groupKind: GroupKind,
  groupId: string,
): Promise<SoundGroup | undefined> {
  switch (groupKind) {
    case "shape":
      return getShapeGroup(lang, groupId);
    case "false-friend":
      return getFalseFriendGroup(lang, groupId);
    case "initial":
      return getInitialGroup(lang, groupId);
    default:
      return getSoundGroup(lang, groupId);
  }
}

export function getAllWordsInGroup(group: SoundGroup): VocabWord[] {
  return group.roots.flatMap((r) => flattenWords(r.words));
}

export function wordCount(group: SoundGroup): number {
  return getAllWordsInGroup(group).length;
}

/** Chuẩn hoá cách đọc để so sánh (bỏ khoảng trắng thừa, chuẩn hoá Unicode, không phân biệt hoa/thường)
 * — dùng khi cần kiểm tra 2 nhóm có "cùng 1 âm" hay không trước khi tạo nhóm mới, tránh trùng lặp. */
export function normalizeReading(reading: string): string {
  return reading.trim().normalize("NFC").toLowerCase();
}

/** Tìm nhóm ÂM đã tồn tại (trong dữ liệu đã merge tĩnh + Redis) có cùng cách đọc, để quyết định gộp
 * chữ gốc mới vào nhóm đó (addExtraRoot) thay vì tạo hẳn 1 nhóm mới trùng lặp (addExtraGroup).
 *
 * Với tiếng Trung, so khớp CẢ theo `pinyinToneKey` (không phân biệt cách ghi thanh điệu — dấu thanh
 * "fēng" hay số thanh "feng1") bên cạnh so khớp chuỗi thường: AI không được ép trả về pinyin theo
 * đúng 1 kiểu ghi cố định, nên 2 lần gọi độc lập cho 2 chữ THỰC SỰ đồng âm (vd 峰/风/疯 đều "fēng")
 * có thể trả về reading khác nhau về MẶT CHUỖI dù cùng 1 âm — nếu chỉ so `normalizeReading` sẽ tạo
 * nhầm 2 nhóm trùng lặp cho cùng 1 âm thay vì gộp lại (bug đã ghi nhận, xem Bugs.md). */
export function findGroupByReading(
  data: LanguageData,
  reading: string,
  language?: Language,
): SoundGroup | undefined {
  const target = normalizeReading(reading);
  const toneKey = language === "zh" ? pinyinToneKey(reading) : null;
  return data.groups.find((g) => {
    if (normalizeReading(g.reading) === target) return true;
    if (toneKey && pinyinToneKey(g.reading) === toneKey) return true;
    return false;
  });
}

export async function addExtraWords(lang: Language, rootId: string, words: VocabWord[]): Promise<void> {
  const additions = await loadAdditions(lang);
  additions.extraWords[rootId] = [...(additions.extraWords[rootId] ?? []), ...words];
  await kvSet(kvKey(lang), additions);
}

export async function addExtraRoot(lang: Language, groupId: string, root: RootEntry): Promise<void> {
  const additions = await loadAdditions(lang);
  additions.extraRoots[groupId] = [...(additions.extraRoots[groupId] ?? []), root];
  await kvSet(kvKey(lang), additions);
}

export async function addWordChildren(lang: Language, wordId: string, children: VocabWord[]): Promise<void> {
  const additions = await loadAdditions(lang);
  additions.wordChildren[wordId] = [...(additions.wordChildren[wordId] ?? []), ...children];
  await kvSet(kvKey(lang), additions);
}

export async function addExtraGroup(lang: Language, group: SoundGroup): Promise<void> {
  const additions = await loadAdditions(lang);
  additions.extraGroups = [...additions.extraGroups, group];
  await kvSet(kvKey(lang), additions);
}

/** Id nhóm "Từ tự tra" của một ngôn ngữ. CỐ ĐỊNH (không genId) để mọi lần tra sau đều rơi vào đúng
 * nhóm đó thay vì sinh ra một nhóm mới mỗi lần — và để link `/[lang]/[groupId]` gửi cho người học hôm
 * nay vẫn còn đúng sau này. */
export function lookupGroupId(lang: Language): string {
  return `${lang}-ai-lookup`;
}

function lookupRootId(lang: Language, theme: string): string {
  return `${lang}-ai-lookup-${theme}`;
}

/** Lưu MỘT từ/cụm/câu người học vừa tra bằng AI vào kho riêng của họ, để nó thành từ vựng thật: hiện
 * trong bộ lọc "✚ Tự thêm", vào được SRS, đánh dấu yêu thích/đã thuộc, ôn tập được — chứ không chỉ nằm
 * trong nhật ký "✨ Mới thêm" ở /my-vocab như trước (nhật ký đó chỉ để xem lại, không phải từ vựng).
 *
 * Mỗi ngôn ngữ có ĐÚNG MỘT nhóm "Từ tự tra" (id cố định), trong đó mỗi theme AI là một chữ gốc riêng —
 * nhờ vậy mindmap của nhóm này chẻ sẵn theo kiểu tra ("Tra nhanh", "Thành ngữ", "Mổ xẻ câu"...) thay vì
 * dồn tất cả vào một nhánh dài.
 *
 * Tra LẠI một từ đã tra rồi thì GHI ĐÈ nội dung nhưng GIỮ NGUYÊN `id` cũ, vì id chính là khoá của tiến
 * độ SRS/yêu thích/đã thuộc (`progress:main`) — đổi id là người học mất sạch lịch sử ôn tập của từ đó. */
export async function saveLookupWord(
  lang: Language,
  theme: string,
  branch: { label: string; meaningVn: string },
  word: Omit<VocabWord, "id">,
): Promise<{ groupId: string; wordId: string; replaced: boolean }> {
  const additions = await loadAdditions(lang);
  const groupId = lookupGroupId(lang);
  const rootId = lookupRootId(lang, theme);

  let group = additions.extraGroups.find((g) => g.id === groupId);
  if (!group) {
    group = {
      id: groupId,
      language: lang,
      reading: "Từ tự tra",
      note: "Mọi từ, thành ngữ và câu bạn đã nhờ AI giải thích đều tự động vào đây.",
      category: "✚ Từ tự tra",
      addedAt: new Date().toISOString(),
      roots: [],
    };
    additions.extraGroups = [...additions.extraGroups, group];
  }

  let root = group.roots.find((r) => r.id === rootId);
  if (!root) {
    root = { id: rootId, character: branch.label, meaningVn: branch.meaningVn, words: [] };
    group.roots = [...group.roots, root];
  } else {
    // Nhãn/mô tả nhánh là chữ của app, không phải dữ liệu người học — đồng bộ lại mỗi lần ghi để sửa
    // câu chữ trong code là nhánh cũ trong KV cũng đổi theo, khỏi phải viết script vá dữ liệu.
    root.character = branch.label;
    root.meaningVn = branch.meaningVn;
  }

  const existing = root.words.find((w) => w.headword === word.headword);
  const id = existing?.id ?? genId("word");
  const saved: VocabWord = {
    ...existing,
    ...word,
    id,
    ...(word.children ? { children: assignChildIds(word.children, existing?.children ?? []) } : {}),
  };
  root.words = existing
    ? root.words.map((w) => (w.id === id ? saved : w))
    : [...root.words, saved];
  await kvSet(kvKey(lang), additions);
  return { groupId, wordId: id, replaced: !!existing };
}

/** Cấp id cho các từ con AI vừa sinh (`lookupWordFromCard` để `id` rỗng vì nó không đọc được kho). Từ
 * con nào trùng `headword` với lần tra trước thì GIỮ id cũ — id là khoá của tiến độ SRS/yêu thích, nên
 * tra lại một thành ngữ không được làm người học mất lịch sử ôn từng chữ trong đó. */
function assignChildIds(next: VocabWord[], previous: VocabWord[]): VocabWord[] {
  return next.map((c) => {
    const old = previous.find((p) => p.headword === c.headword);
    return {
      ...c,
      id: old?.id ?? genId("word"),
      ...(c.children ? { children: assignChildIds(c.children, old?.children ?? []) } : {}),
    };
  });
}

export { STATIC_DATA, ALL_LANGUAGES };
