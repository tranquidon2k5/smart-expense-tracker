import { Injectable } from "@nestjs/common";
import {
  SUGGESTED_QUESTIONS,
  isOutOfScope,
  monthsOfCall,
  refuseAnswer,
  runTool,
  type EngineAnswer,
} from "@shared/assistant-engine";
import type { AskResult, ChatToolCall, Conversation, ConversationSummary } from "@shared/types";
import { AiService } from "../ai/ai.service";
import { LLM_PROVIDER, type LlmProvider } from "../ai/llm.provider";
import { Inject } from "@nestjs/common";
import type { AuthUser } from "../common/auth";
import { ClockService } from "../common/clock.service";
import { AppConfig } from "../common/config";
import type { Db } from "../common/db";
import { AppError, badRequest, notFound } from "../common/errors";
import { dbDate, isoDateTime, toBudget, toCategory, toChatMessageView, toTransaction } from "../common/mappers";
import { PrismaService } from "../common/prisma.service";
import { GamificationService } from "../gamification/gamification.service";
import { nextMonthStart } from "../transactions/transactions.service";

export const QUESTION_MAX_LENGTH = 300;
export { SUGGESTED_QUESTIONS };

function titleFrom(question: string) {
  const t = question.trim().replace(/[?!.]+$/, "");
  return t.length > 48 ? `${t.slice(0, 47)}…` : t;
}

/**
 * Trợ lý AI (F10, Luồng 3): LLM chỉ chọn công cụ (function calling); công cụ chạy truy vấn có
 * tham số trên dữ liệu của chính người dùng và soạn câu trả lời bằng engine dùng chung — số liệu
 * và giao dịch nguồn (`sourceIds`) không bao giờ do LLM viết ra.
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly config: AppConfig,
    private readonly ai: AiService,
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
    private readonly gamification: GamificationService,
  ) {}

  async list(userId: string): Promise<ConversationSummary[]> {
    const rows = await this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { messages: { where: { role: "user" } } } } },
    });
    return rows.map((c) => ({ id: c.id, title: c.title, updatedAt: isoDateTime(c.updatedAt), questionCount: c._count.messages }));
  }

  private async load(db: Db, userId: string, id: string): Promise<Conversation | null> {
    const c = await db.conversation.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
    });
    if (!c) return null;
    return {
      id: c.id,
      title: c.title,
      createdAt: isoDateTime(c.createdAt),
      updatedAt: isoDateTime(c.updatedAt),
      messages: c.messages.map(toChatMessageView),
    };
  }

  async get(userId: string, id: string): Promise<Conversation> {
    const c = await this.load(this.prisma, userId, id);
    if (!c) throw notFound("Không tìm thấy cuộc trò chuyện, có thể đã bị xoá.");
    return c;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.conversation.deleteMany({ where: { id, userId } });
  }

  /** Chạy công cụ trên dữ liệu thật: chỉ truy vấn đúng các tháng công cụ cần */
  async runToolFor(userId: string, call: ChatToolCall, today: string): Promise<EngineAnswer> {
    const months = monthsOfCall(call, today);
    const ranges = months.map((m) => ({ date: { gte: dbDate(`${m}-01`), lt: dbDate(nextMonthStart(m)) } }));
    const [transactions, categories, budgets] = await Promise.all([
      this.prisma.transaction.findMany({ where: { userId, OR: ranges }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
      this.prisma.category.findMany({ where: { OR: [{ userId: null }, { userId }] }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      this.prisma.budget.findMany({ where: { userId, month: { in: months } } }),
    ]);
    return runTool(call, {
      transactions: transactions.map(toTransaction),
      categories: categories.map(toCategory),
      budgets: budgets.map(toBudget),
      today,
    });
  }

  /** Câu hỏi → câu trả lời. Ngoài phạm vi thì từ chối trước, không tốn lượt gọi LLM. */
  async answer(user: AuthUser, question: string): Promise<EngineAnswer> {
    if (isOutOfScope(question)) return refuseAnswer("invest");
    const today = this.clock.today(user.timezone);
    const categories = (await this.prisma.category.findMany({ where: { OR: [{ userId: null }, { userId: user.id }] } })).map(toCategory);
    let choice;
    try {
      choice = await this.ai.call("chat", user.id, this.config.get("CHAT_TIMEOUT_MS") - 500, (signal) =>
        this.provider.chooseTool(question, { today, categories }, signal),
      );
    } catch {
      throw new AppError(504, "Trợ lý trả lời quá 5 giây. Có thể mạng đang chậm, bạn thử lại nhé.", { code: "CHAT_TIMEOUT" });
    }
    if (!choice.call) return refuseAnswer("other");
    return this.runToolFor(user.id, choice.call, today);
  }

  /**
   * Hỏi trợ lý. conversationId = null → tạo cuộc trò chuyện mới. Lỗi / quá giờ thì không lưu gì.
   * Câu hỏi trong phạm vi tính vào nhiệm vụ "Hỏi trợ lý AI 1 câu" và huy hiệu "Trò chuyện cùng AI".
   */
  async ask(user: AuthUser, conversationId: string | null, question: string): Promise<AskResult> {
    const text = (question ?? "").trim();
    if (!text) throw badRequest("Nhập câu hỏi trước khi gửi nhé.", "question");
    if (text.length > QUESTION_MAX_LENGTH) throw badRequest(`Câu hỏi tối đa ${QUESTION_MAX_LENGTH} ký tự.`, "question");
    if (conversationId && !(await this.prisma.conversation.findFirst({ where: { id: conversationId, userId: user.id } }))) {
      throw notFound("Không tìm thấy cuộc trò chuyện, có thể đã bị xoá.");
    }
    const answer = await this.answer(user, text);
    const today = this.clock.today(user.timezone);

    return this.prisma.$transaction(async (db) => {
      const now = this.clock.now();
      const conversation = conversationId
        ? await db.conversation.update({ where: { id: conversationId }, data: { updatedAt: now } })
        : await db.conversation.create({ data: { userId: user.id, title: titleFrom(text), createdAt: now, updatedAt: now } });
      const userMessage = await db.chatMessage.create({
        data: { userId: user.id, conversationId: conversation.id, role: "user", content: text, createdAt: now },
      });
      const assistantMessage = await db.chatMessage.create({
        data: {
          userId: user.id,
          conversationId: conversation.id,
          role: "assistant",
          content: answer.content,
          toolCalls: answer.toolCalls as unknown as object,
          sourceIds: answer.sourceIds,
          refused: answer.refused,
          createdAt: new Date(now.getTime() + 1),
        },
      });
      if (answer.refused) {
        // Câu bị từ chối không tính là "đã hỏi" cho nhiệm vụ / huy hiệu
        await db.chatMessage.update({ where: { id: userMessage.id }, data: { refused: true } });
      } else {
        await this.gamification.bumpMission(db, user.id, "DAILY_ASK_CHAT", today);
        await this.gamification.evaluateBadges(db, user.id, today);
      }
      const full = (await this.load(db, user.id, conversation.id))!;
      return {
        conversation: full,
        userMessage: toChatMessageView(userMessage),
        assistantMessage: toChatMessageView(assistantMessage),
      };
    });
  }
}
