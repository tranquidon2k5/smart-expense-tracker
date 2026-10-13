/**
 * Lớp nhà cung cấp LLM (PRD §9.1). LLM chỉ làm ba việc: trích xuất câu ghi nhanh, đoán danh mục
 * khi luật không khớp, và chọn công cụ cho chatbot. Mọi con số do backend tính.
 * Quyền riêng tư (§8): chỉ gửi mô tả giao dịch, số tiền, tên danh mục — không gửi tên hay email.
 */
import OpenAI from "openai";
import { LLM_GUESSES, paddedNormalize, parseQuickEntryText } from "@shared/quick-entry";
import { TOOL_DEFINITIONS, planQuestion } from "@shared/assistant-engine";
import type { Category, ChatToolCall, TransactionType } from "@shared/types";

export const LLM_PROVIDER = Symbol("LLM_PROVIDER");

export interface LlmResult<T> {
  value: T;
  tokens: number;
}

export interface ExtractedEntry {
  so_tien: number | null;
  loai: TransactionType;
  /** yyyy-MM-dd */
  ngay: string;
  mo_ta: string;
}

export interface ClassifyItem {
  description: string;
  amount?: number;
  type?: TransactionType;
}

export interface ClassifyGuess {
  categoryId: string | null;
  confidence: number;
}

export interface ToolChoice {
  /** null = câu hỏi ngoài phạm vi / không hiểu */
  call: ChatToolCall | null;
}

export interface LlmProvider {
  readonly name: "openai" | "rules";
  extract(text: string, ctx: { today: string }, signal: AbortSignal): Promise<LlmResult<ExtractedEntry>>;
  classify(items: ClassifyItem[], categories: Category[], signal: AbortSignal): Promise<LlmResult<ClassifyGuess[]>>;
  chooseTool(question: string, ctx: { today: string; categories: Category[] }, signal: AbortSignal): Promise<LlmResult<ToolChoice>>;
}

// ───────────── Dự phòng: chỉ luật (không cần khoá API) ─────────────

export class RuleOnlyProvider implements LlmProvider {
  readonly name = "rules" as const;

  async extract(text: string, ctx: { today: string }): Promise<LlmResult<ExtractedEntry>> {
    const r = parseQuickEntryText(text, ctx.today);
    return { value: { so_tien: r.amount, loai: r.type, ngay: r.date, mo_ta: r.description }, tokens: 0 };
  }

  /** Từ khoá gợi ý (siêu thị, nhà thuốc…) — đoán được nhưng chưa chắc (< 0,7 → chờ duyệt) */
  async classify(items: ClassifyItem[], categories: Category[]): Promise<LlmResult<ClassifyGuess[]>> {
    const value = items.map((item) => {
      const norm = paddedNormalize(item.description);
      for (const g of LLM_GUESSES) {
        const c = categories.find((x) => x.id === g.categoryId && (!item.type || x.type === item.type));
        if (c && g.keywords.some((k) => norm.includes(k))) return { categoryId: c.id, confidence: g.confidence };
      }
      return { categoryId: null, confidence: 0.45 };
    });
    return { value, tokens: 0 };
  }

  async chooseTool(question: string, ctx: { today: string; categories: Category[] }): Promise<LlmResult<ToolChoice>> {
    const plan = planQuestion(question, ctx);
    return { value: { call: "call" in plan ? plan.call : null }, tokens: 0 };
  }
}

// ───────────── OpenAI ─────────────

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    so_tien: { type: ["integer", "null"], description: "Số tiền VND (đồng), null nếu không có" },
    loai: { type: "string", enum: ["income", "expense"] },
    ngay: { type: "string", description: "Ngày giao dịch yyyy-MM-dd" },
    mo_ta: { type: "string", description: "Mô tả ngắn gọn, viết hoa chữ đầu, không chứa số tiền và ngày" },
  },
  required: ["so_tien", "loai", "ngay", "mo_ta"],
  additionalProperties: false,
} as const;

export class OpenAiProvider implements LlmProvider {
  readonly name = "openai" as const;
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    baseURL?: string,
  ) {
    // Không tự thử lại: đã có giới hạn thời gian và bộ dự phòng bằng luật
    this.client = new OpenAI({ apiKey, baseURL, maxRetries: 0 });
  }

  private async json<T>(
    system: string,
    user: string,
    schemaName: string,
    schema: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<LlmResult<T>> {
    const res = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_schema", json_schema: { name: schemaName, schema, strict: true } },
        max_completion_tokens: 600,
      },
      { signal },
    );
    const content = res.choices[0]?.message.content;
    if (!content) throw new Error("LLM không trả nội dung");
    return { value: JSON.parse(content) as T, tokens: res.usage?.total_tokens ?? 0 };
  }

  extract(text: string, ctx: { today: string }, signal: AbortSignal): Promise<LlmResult<ExtractedEntry>> {
    return this.json<ExtractedEntry>(
      `Bạn trích xuất giao dịch thu/chi từ câu tiếng Việt của người dùng ứng dụng quản lý chi tiêu. Hôm nay là ${ctx.today}. ` +
        `Quy đổi: "k"/"nghìn" = 1.000, "tr"/"triệu"/"củ" = 1.000.000, "1tr2" = 1.200.000. ` +
        `"hôm qua", "hôm kia", "15/10" là ngày giao dịch; không nói ngày thì là hôm nay. ` +
        `Lương, thưởng, được cho, hoàn tiền, bán đồ là thu (income); còn lại là chi (expense).`,
      text,
      "giao_dich",
      EXTRACT_SCHEMA,
      signal,
    );
  }

  async classify(items: ClassifyItem[], categories: Category[], signal: AbortSignal): Promise<LlmResult<ClassifyGuess[]>> {
    const list = categories.map((c) => `- ${c.id}: ${c.name} (${c.type === "income" ? "thu" : "chi"})`).join("\n");
    const lines = items
      .map((it, i) => `${i + 1}. "${it.description}"${it.amount ? ` — ${it.amount}đ` : ""}${it.type ? ` — ${it.type === "income" ? "thu" : "chi"}` : ""}`)
      .join("\n");
    const res = await this.json<{ ket_qua: { stt: number; category_id: string | null; do_tin_cay: number }[] }>(
      `Bạn phân loại giao dịch vào đúng MỘT danh mục trong danh sách (dùng id). Giao dịch thu chỉ vào danh mục thu, chi vào danh mục chi. ` +
        `do_tin_cay từ 0 đến 1: chỉ ≥ 0.7 khi gần như chắc chắn; nội dung mơ hồ (chuyển khoản, mã QR…) thì thấp hoặc category_id null.\n` +
        `Ví dụ: "Phở bò tái" → Ăn uống 0.95; "GRAB*RIDE 1203" → Di chuyển 0.85; "THANH TOAN QR 0912XXX" → null 0.3.\n\nDanh mục:\n${list}`,
      `Phân loại ${items.length} giao dịch:\n${lines}`,
      "phan_loai",
      {
        type: "object",
        properties: {
          ket_qua: {
            type: "array",
            items: {
              type: "object",
              properties: {
                stt: { type: "integer" },
                category_id: { type: ["string", "null"] },
                do_tin_cay: { type: "number" },
              },
              required: ["stt", "category_id", "do_tin_cay"],
              additionalProperties: false,
            },
          },
        },
        required: ["ket_qua"],
        additionalProperties: false,
      },
      signal,
    );
    const value = items.map((item, i) => {
      const r = res.value.ket_qua.find((x) => x.stt === i + 1);
      const c = r?.category_id ? categories.find((x) => x.id === r.category_id) : undefined;
      // Bỏ đáp án không có trong danh sách hoặc sai loại thu/chi (LLM không được bịa danh mục)
      if (!c || (item.type && c.type !== item.type)) return { categoryId: null, confidence: 0.45 };
      return { categoryId: c.id, confidence: Math.min(Math.max(Number(r!.do_tin_cay) || 0, 0), 1) };
    });
    return { value, tokens: res.tokens };
  }

  async chooseTool(question: string, ctx: { today: string; categories: Category[] }, signal: AbortSignal): Promise<LlmResult<ToolChoice>> {
    const names = ctx.categories.map((c) => c.name).join(", ");
    const res = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              `Bạn là trợ lý của ứng dụng Sổ Tiền, chỉ trả lời câu hỏi về thu chi, giao dịch, ngân sách của chính người dùng. ` +
              `Hôm nay là ${ctx.today} (tháng ${ctx.today.slice(0, 7)}). Danh mục: ${names}. ` +
              `Luôn gọi đúng một công cụ phù hợp. Nếu câu hỏi ngoài phạm vi (đầu tư, vay, chủ đề khác) thì KHÔNG gọi công cụ và trả lời "NGOAI_PHAM_VI".`,
          },
          { role: "user", content: question },
        ],
        tools: TOOL_DEFINITIONS.map((t) => ({
          type: "function" as const,
          function: { name: t.name, description: t.description, parameters: t.parameters, strict: true },
        })),
        tool_choice: "auto",
        max_completion_tokens: 300,
      },
      { signal },
    );
    const tokens = res.usage?.total_tokens ?? 0;
    const toolCall = res.choices[0]?.message.tool_calls?.find((c) => c.type === "function");
    if (!toolCall || toolCall.type !== "function") return { value: { call: null }, tokens };
    const args = JSON.parse(toolCall.function.arguments || "{}") as ChatToolCall["args"];
    return { value: { call: { name: toolCall.function.name, args } }, tokens };
  }
}
