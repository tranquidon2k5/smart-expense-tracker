import type { AskResult, ChatMessageView, Conversation, ConversationSummary, TransactionView } from "@/types";
import { answerQuestion, type EngineContext, SUGGESTED_QUESTIONS } from "./assistant-engine";
import * as db from "./mock/db";
import { bumpMission, evaluateBadges, scopedTransactions, toView } from "./mock/queries";
import { dataset } from "./mock/dataset";
import { failIfErrorScenario, getScenario, simulateLatency } from "./mock/scenario";
import { emitDataChanged } from "./events";
import { ChatTimeoutError } from "./errors";
import { USE_API } from "./data-source";
import * as api from "./api/endpoints";

export { ChatTimeoutError };

/** PRD §8: chatbot phản hồi dưới 5 giây — quá thì báo lỗi để người dùng thử lại */
export const CHAT_TIMEOUT_MS = 5000;
export const QUESTION_MAX_LENGTH = 300;


export { SUGGESTED_QUESTIONS };

function context(): EngineContext {
  return {
    transactions: scopedTransactions(),
    categories: db.categories,
    budgets: getScenario() === "empty" ? [] : db.budgets,
    today: db.MOCK_TODAY,
  };
}

let seq = 0;
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`;

function message(role: "user" | "assistant", content: string, at: string, extra?: Partial<ChatMessageView>): ChatMessageView {
  return { id: newId(role === "user" ? "mu" : "ma"), role, content, toolCalls: [], sourceIds: [], refused: false, createdAt: at, ...extra };
}

function exchange(question: string, at: string): ChatMessageView[] {
  const a = answerQuestion(question, context());
  return [message("user", question, at), message("assistant", a.content, at, a)];
}

/** Lịch sử hội thoại (chat_messages). Câu trả lời mẫu cũng được tính từ dữ liệu thật. */
let conversations: Conversation[] | null = null;
let conversationsVersion = -1;
function store(): Conversation[] {
  if (getScenario() === "empty") return [];
  if (conversationsVersion !== dataset.version) {
    conversations = null;
    conversationsVersion = dataset.version;
  }
  // Hội thoại mẫu chỉ có ở sổ của Lan; tài khoản khác bắt đầu với lịch sử trống
  if (!conversations && dataset.ownerId !== db.USER_ID) conversations = [];
  if (!conversations) {
    const at1 = "2026-10-11T21:05:00+07:00";
    const at2 = "2026-10-05T12:20:00+07:00";
    conversations = [
      {
        id: "cv-1",
        title: "Tiền ăn tháng 9 so với tháng 8",
        createdAt: at1,
        updatedAt: at1,
        messages: [...exchange("Tháng 9 mình tiêu ăn uống bao nhiêu?", at1), ...exchange("So sánh ăn uống tháng 9 với tháng 8", at1)],
      },
      {
        id: "cv-2",
        title: "Khoản chi lớn tháng 9",
        createdAt: at2,
        updatedAt: at2,
        messages: exchange("5 khoản chi lớn nhất tháng 9", at2),
      },
    ];
  }
  return conversations;
}

function summarize(c: Conversation): ConversationSummary {
  return { id: c.id, title: c.title, updatedAt: c.updatedAt, questionCount: c.messages.filter((m) => m.role === "user").length };
}

export async function listConversations(): Promise<ConversationSummary[]> {
  if (USE_API) return api.chat.listConversations();
  await simulateLatency(300);
  failIfErrorScenario();
  return [...store()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(summarize);
}

export async function getConversation(id: string): Promise<Conversation | null> {
  if (USE_API) return api.chat.getConversation(id);
  await simulateLatency(250);
  failIfErrorScenario();
  const c = store().find((x) => x.id === id);
  return c ? structuredClone(c) : null;
}

/** Giao dịch nguồn của một câu trả lời (bỏ qua giao dịch đã bị xoá sau đó) */
export async function getSources(ids: string[]): Promise<TransactionView[]> {
  if (USE_API) return api.chat.getSources(ids);
  await simulateLatency(200);
  const byId = new Map(scopedTransactions().map((t) => [t.id, t]));
  return ids.flatMap((id) => {
    const t = byId.get(id);
    return t ? [toView(t)] : [];
  });
}

function titleFrom(question: string) {
  const t = question.trim().replace(/[?!.]+$/, "");
  return t.length > 48 ? `${t.slice(0, 47)}…` : t;
}

/**
 * Hỏi trợ lý. conversationId = null → tạo cuộc trò chuyện mới.
 * Lỗi / quá 5 giây thì KHÔNG lưu gì, giao diện giữ câu hỏi để người dùng bấm Thử lại.
 * Câu hỏi trong phạm vi được tính vào nhiệm vụ "Hỏi trợ lý AI 1 câu" và huy hiệu "Trò chuyện cùng AI".
 */
export async function ask(conversationId: string | null, question: string): Promise<AskResult> {
  if (USE_API) return api.chat.ask(conversationId, question);
  const text = question.trim();
  if (!text) throw new Error("Nhập câu hỏi trước khi gửi nhé.");
  if (text.length > QUESTION_MAX_LENGTH) throw new Error(`Câu hỏi tối đa ${QUESTION_MAX_LENGTH} ký tự.`);

  const thinking = simulateLatency(getScenario() === "slow" ? CHAT_TIMEOUT_MS + 3000 : 1100);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ChatTimeoutError()), CHAT_TIMEOUT_MS);
  });
  try {
    await Promise.race([thinking, timeout]);
  } finally {
    clearTimeout(timer);
  }
  failIfErrorScenario();

  const now = new Date().toISOString();
  let conversation = conversationId ? store().find((c) => c.id === conversationId) : undefined;
  if (!conversation) {
    conversation = { id: newId("cv"), title: titleFrom(text), createdAt: now, updatedAt: now, messages: [] };
    store().unshift(conversation);
  }
  const [userMessage, assistantMessage] = exchange(text, now);
  conversation.messages.push(userMessage, assistantMessage);
  conversation.updatedAt = now;

  if (!assistantMessage.refused) {
    db.session.chatQuestions += 1;
    bumpMission("m-d-chat");
    evaluateBadges();
  }
  emitDataChanged();
  return { conversation: structuredClone(conversation), userMessage, assistantMessage };
}

export async function deleteConversation(id: string): Promise<void> {
  if (USE_API) return api.chat.deleteConversation(id);
  await simulateLatency(250);
  const list = store();
  const i = list.findIndex((c) => c.id === id);
  if (i >= 0) list.splice(i, 1);
  emitDataChanged();
}
