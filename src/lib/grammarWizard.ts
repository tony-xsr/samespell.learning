import "server-only";
import type { Language } from "@/types/vocab";
import type { GrammarLanguageData, GrammarPoint } from "@/types/grammar";
import { getGrammarPoint } from "@/lib/grammarStore";

/** Trục E (mindmap ngữ pháp) — cây quyết định "tôi muốn nói..." dẫn người học tới đúng điểm ngữ pháp,
 * thay vì hỏi ngược "cấu trúc X là gì". Cây dùng chung 1 cấu trúc khái niệm cho cả 2 ngôn ngữ (vì phần
 * lớn khái niệm — quá khứ/tương lai/điều kiện/lý do/so sánh — tồn tại song song ở cả Hàn và Nhật), mỗi
 * lá chỉ tham chiếu `pointIds` (id của GrammarPoint đã có ở Trục A, KHÔNG tạo dữ liệu ngữ pháp mới ở
 * đây) theo từng ngôn ngữ — 1 số lá chỉ có ở 1 ngôn ngữ vì bản thân ngữ pháp đó không có ở ngôn ngữ kia
 * (vd 았/었었 quá khứ-đối-lập-hiện-tại là đặc trưng riêng của tiếng Hàn). */

export interface WizardLeaf {
  id: string;
  label: string;
  /** id GrammarPoint tương ứng theo từng ngôn ngữ — undefined nếu ngôn ngữ đó không có cấu trúc tương
   * đương (sẽ hiển thị ghi chú thay vì báo lỗi). */
  pointIds: Partial<Record<Language, string>>;
  /** Ghi chú thêm khi 2 ngôn ngữ không khớp hoàn toàn 1-1 (vd Hàn dùng chung 1 dạng cho việc mà Nhật
   * tách thành 2 dạng riêng). */
  crossLangNote?: string;
}

export interface WizardNode {
  id: string;
  question: string;
  children: (WizardNode | WizardLeaf)[];
}

export function isWizardLeaf(node: WizardNode | WizardLeaf): node is WizardLeaf {
  return "pointIds" in node;
}

export const GRAMMAR_WIZARD_ROOT: WizardNode = {
  id: "root",
  question: "Bạn muốn diễn đạt điều gì?",
  children: [
    {
      id: "past",
      question: "Một việc đã xảy ra (quá khứ) — bạn muốn nhấn mạnh điều gì?",
      children: [
        {
          id: "past-plain",
          label: "Chỉ đơn thuần đã xảy ra, có mốc thời gian rõ ràng",
          pointIds: { ko: "ko-tense-past", ja: "ja-conj-takei" },
        },
        {
          id: "past-experience",
          label: "Đã từng trải nghiệm, không quan trọng khi nào",
          pointIds: { ko: "ko-tense-abon-jeogi-itda", ja: "ja-conj-takotogaaru" },
        },
        {
          id: "past-contrast",
          label: "Đã hoàn toàn kết thúc, khác hẳn bây giờ (ngụ ý đối lập với hiện tại)",
          pointIds: { ko: "ko-tense-assseotda" },
          crossLangNote: "Tiếng Nhật không có dạng chia riêng cho sắc thái này — thường phải diễn đạt bằng cách thêm cụm từ như 今は違うが (bây giờ thì khác) vào câu quá khứ thường (た形).",
        },
        {
          id: "past-ongoing",
          label: "Đang làm dở dang / hồi tưởng lại việc lặp lại nhiều lần trong quá khứ",
          pointIds: { ko: "ko-tense-deon" },
          crossLangNote: "Tiếng Nhật không có dạng chia riêng cho sắc thái 'dang dở/hồi tưởng lặp lại' này.",
        },
      ],
    },
    {
      id: "future",
      question: "Một việc sắp/sẽ xảy ra (tương lai) — bạn muốn nhấn mạnh điều gì?",
      children: [
        {
          id: "future-planned",
          label: "Đã lên kế hoạch/quyết định rồi",
          pointIds: { ko: "ko-modal-girohada", ja: "ja-modal-tsumori" },
        },
        {
          id: "future-guess",
          label: "Chỉ là suy đoán, chưa chắc chắn",
          pointIds: { ko: "ko-tense-get", ja: "ja-conj-deshou" },
        },
        {
          id: "future-suggest",
          label: "Muốn rủ rê người khác cùng làm (trang trọng)",
          pointIds: { ko: "ko-qc-eupsida", ja: "ja-qc-mashou" },
        },
      ],
    },
    {
      id: "conditional",
      question: "Giả định / điều kiện — tình huống của bạn gần với cái nào hơn?",
      children: [
        {
          id: "cond-general",
          label: "Quy luật chung, luôn đúng (vd 'nếu đến mùa xuân thì hoa nở')",
          pointIds: { ko: "ko-conn-myeon", ja: "ja-cond-ba" },
          crossLangNote: "Tiếng Hàn dùng chung (으)면 cho cả quy luật chung LẪN điều kiện 1 lần cụ thể (xem nhánh bên dưới) — tiếng Nhật tách riêng thành ば (quy luật) và たら (1 lần).",
        },
        {
          id: "cond-flexible",
          label: "Điều kiện 1 lần cụ thể, linh hoạt (có thể dùng cả với mệnh lệnh/ý định)",
          pointIds: { ko: "ko-conn-myeon", ja: "ja-cond-tara" },
        },
        {
          id: "cond-hypothetical",
          label: "Giả định xa vời, ít thực tế (kiểu 'giả sử trúng số...')",
          pointIds: { ko: "ko-cond-damyeon" },
          crossLangNote: "Tiếng Nhật không có dạng chia riêng biệt cho sắc thái 'giả định xa vời' này — thường vẫn dùng たら hoặc thêm もし (nếu như) để nhấn mạnh.",
        },
      ],
    },
    {
      id: "reason",
      question: "Bạn muốn đưa ra lý do — vế sau câu của bạn là gì?",
      children: [
        {
          id: "reason-plain",
          label: "Câu tường thuật đơn thuần (không phải mệnh lệnh/đề nghị)",
          pointIds: { ko: "ko-conn-aseo", ja: "ja-conn-node" },
        },
        {
          id: "reason-imperative",
          label: "Mệnh lệnh, đề nghị, hoặc rủ rê",
          pointIds: { ko: "ko-conn-nikka", ja: "ja-conn-kara" },
          crossLangNote: "Chiều ngược nhau giữa 2 ngôn ngữ: tiếng Hàn 아서 KHÔNG được dùng trước mệnh lệnh (phải đổi sang 니까), còn tiếng Nhật から lại chính là dạng THƯỜNG DÙNG trước mệnh lệnh/đề nghị.",
        },
      ],
    },
    {
      id: "comparison",
      question: "So sánh — bạn đang so sánh theo hướng nào?",
      children: [
        {
          id: "compare-superior",
          label: "A hơn/kém B (bất đối xứng)",
          pointIds: { ko: "ko-comp-boda", ja: "ja-comp-yori" },
        },
        {
          id: "compare-equal",
          label: "A ngang bằng/giống như B",
          pointIds: { ko: "ko-particle-mankeum", ja: "ja-comp-gurai" },
          crossLangNote: "ぐらい/くらい tiếng Nhật là cách gần đúng nhất cho sắc thái 'ngang bằng' — không hoàn toàn tương đương 만큼 tiếng Hàn (만큼 chuyên biệt hơn cho so sánh mức độ ngang bằng).",
        },
      ],
    },
    {
      id: "request",
      question: "Đề nghị lịch sự — bạn muốn nhờ ai đó làm gì?",
      children: [
        {
          id: "request-polite",
          label: "Xin hãy làm gì đó (lịch sự, phổ biến hằng ngày)",
          pointIds: { ko: "ko-qc-euseyo", ja: "ja-qc-tekudasai" },
        },
      ],
    },
  ],
};

/** Dạng "đã resolve" của cây wizard cho 1 ngôn ngữ cụ thể — thay `pointIds` (chỉ là id) bằng
 * `point` (dữ liệu GrammarPoint đầy đủ, lấy từ Trục A) để client component không cần tra cứu lại. */
export interface ResolvedWizardLeaf {
  kind: "leaf";
  id: string;
  label: string;
  point?: GrammarPoint;
  crossLangNote?: string;
}

export interface ResolvedWizardNode {
  kind: "node";
  id: string;
  question: string;
  children: (ResolvedWizardNode | ResolvedWizardLeaf)[];
}

function resolveNode(
  node: WizardNode,
  data: GrammarLanguageData,
  lang: Language,
): ResolvedWizardNode {
  return {
    kind: "node",
    id: node.id,
    question: node.question,
    children: node.children.map((child): ResolvedWizardNode | ResolvedWizardLeaf => {
      if (isWizardLeaf(child)) {
        const pointId = child.pointIds[lang];
        return {
          kind: "leaf",
          id: child.id,
          label: child.label,
          point: pointId ? getGrammarPoint(data, pointId) : undefined,
          crossLangNote: child.crossLangNote,
        };
      }
      return resolveNode(child, data, lang);
    }),
  };
}

export function resolveWizardForLanguage(data: GrammarLanguageData, lang: Language): ResolvedWizardNode {
  return resolveNode(GRAMMAR_WIZARD_ROOT, data, lang);
}
