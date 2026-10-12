"use client";

import {
  Bot,
  CircleAlert,
  Clock,
  Database,
  History,
  Info,
  Loader2,
  RotateCw,
  SendHorizontal,
  SquarePen,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { ChatMessageView, ChatToolCall, Conversation } from "@/types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryChip } from "@/components/category-icon";
import { ErrorState } from "@/components/error-state";
import { Money } from "@/components/money";
import { PageContainer } from "@/components/page-header";
import { useServiceQuery } from "@/hooks/use-service-query";
import { chatService } from "@/services";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Pending = { question: string; status: "sending" | "error" | "timeout"; error?: string };

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatArgs(call: ChatToolCall) {
  return Object.entries(call.args)
    .map(([k, v]) => `${k}: ${v === null ? "null" : typeof v === "number" ? v : `"${v}"`}`)
    .join(", ");
}

function ToolCalls({ calls }: { calls: ChatToolCall[] }) {
  if (!calls.length) return null;
  return (
    <div className="mt-3 flex flex-col gap-1.5 border-t pt-2.5">
      {calls.map((c, i) => (
        <p key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Wrench aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Đã gọi công cụ{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px] break-all text-foreground">
              {c.name}({formatArgs(c)})
            </code>
          </span>
        </p>
      ))}
    </div>
  );
}

function AssistantBubble({
  m,
  selected,
  onSelect,
}: {
  m: ChatMessageView;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span aria-hidden className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
        <Bot className="size-4" />
      </span>
      <div
        className={cn(
          "min-w-0 max-w-[85%] rounded-2xl rounded-tl-md border bg-card px-4 py-3",
          m.refused && "bg-muted/60",
          selected && "border-primary ring-1 ring-primary",
        )}
      >
        <p className="sr-only">Trợ lý:</p>
        {m.refused && (
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Info aria-hidden className="size-3.5" /> Ngoài phạm vi hỗ trợ
          </p>
        )}
        <p className="text-[15px] leading-6 whitespace-pre-line">{m.content}</p>
        <ToolCalls calls={m.toolCalls} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {m.sourceIds.length > 0 ? (
            <Button
              variant={selected ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={selected}
              onClick={onSelect}
              className="-ml-2 text-primary max-md:h-11"
            >
              <Database aria-hidden /> Xem <span className="num">{m.sourceIds.length}</span> giao dịch nguồn
            </Button>
          ) : (
            <span />
          )}
          <time className="num text-[11px] text-muted-foreground" dateTime={m.createdAt}>
            {formatTime(m.createdAt)}
          </time>
        </div>
      </div>
    </li>
  );
}

function UserBubble({ text, time, failed }: { text: string; time?: string; failed?: boolean }) {
  return (
    <li className="flex justify-end">
      <div className={cn("max-w-[80%] rounded-2xl rounded-tr-md bg-accent px-4 py-2.5 text-accent-foreground", failed && "opacity-80")}>
        <p className="sr-only">Bạn:</p>
        <p className="text-[15px] leading-6 whitespace-pre-line text-foreground">{text}</p>
        {time && (
          <time className="num mt-0.5 block text-right text-[11px] text-muted-foreground" dateTime={time}>
            {formatTime(time)}
          </time>
        )}
      </div>
    </li>
  );
}

function SourcesPanel({ message, question }: { message: ChatMessageView | null; question: string | null }) {
  const ids = message?.sourceIds ?? [];
  const query = useServiceQuery(() => chatService.getSources(ids), message?.id ?? "");
  const rows = message ? (query.data ?? []) : [];
  const income = rows.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = rows.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  return (
    <section aria-labelledby="sources-title" className="flex min-h-0 flex-col rounded-xl border bg-card xl:h-full">
      <header className="border-b px-4 py-4 md:px-5">
        <h2 id="sources-title" className="flex items-center gap-2 text-lg leading-[26px] font-semibold">
          <Database aria-hidden className="size-5 text-muted-foreground" /> Giao dịch nguồn
        </h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {message && question ? (
            <>
              Căn cứ cho câu trả lời: <span className="text-foreground">“{question}”</span>
            </>
          ) : (
            "Các giao dịch mà trợ lý dùng để tính số liệu."
          )}
        </p>
      </header>

      {!message ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center text-sm text-muted-foreground">
          <Database aria-hidden className="mb-3 size-8 opacity-50" />
          Chọn “Xem giao dịch nguồn” ở một câu trả lời để kiểm tra con số đến từ đâu.
        </div>
      ) : ids.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center text-sm text-muted-foreground">
          Câu trả lời này không dựa trên giao dịch cụ thể nào.
        </div>
      ) : query.loading ? (
        <div aria-hidden className="flex flex-col gap-3 p-5">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-b bg-surface-subtle px-4 py-2 text-[13px] md:px-5">
            <span className="text-muted-foreground">
              <span className="num">{rows.length}</span> giao dịch
            </span>
            {income > 0 && (
              <span>
                Thu <Money amount={income} type="income" className="font-semibold" />
              </span>
            )}
            {expense > 0 && (
              <span>
                Chi <Money amount={expense} type="expense" className="font-semibold" />
              </span>
            )}
          </div>
          <ul aria-label="Danh sách giao dịch nguồn" className="min-h-0 flex-1 overflow-y-auto">
            {rows.map((t) => (
              <li key={t.id} className="border-b last:border-0">
                <Link
                  href={`/giao-dich?id=${t.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-row-hover md:px-5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm" title={t.description}>
                      {t.description}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="num">{formatDate(t.date)}</span>
                      <CategoryChip name={t.category.name} color={t.category.color} className="text-xs" />
                    </span>
                  </span>
                  <Money amount={t.amount} type={t.type} className="text-sm font-medium" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function AssistantPage() {
  const list = useServiceQuery(() => chatService.listConversations());
  const [conversation, setConversation] = React.useState<Conversation | null>(null);
  const openedInitial = React.useRef(false);
  const [loadingConversation, setLoadingConversation] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [input, setInput] = React.useState("");
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const logRef = React.useRef<HTMLOListElement>(null);
  // Mỗi lần mở / tạo cuộc trò chuyện tăng số này; kết quả tải về muộn của lần trước bị bỏ qua
  const openSeq = React.useRef(0);

  const open = React.useCallback(async (id: string) => {
    const seq = ++openSeq.current;
    setLoadingConversation(true);
    setHistoryOpen(false);
    setPending(null);
    try {
      const c = await chatService.getConversation(id);
      if (seq !== openSeq.current) return;
      setConversation(c);
      const lastAnswer = c?.messages.filter((m) => m.role === "assistant").at(-1);
      setSelectedId(lastAnswer && lastAnswer.sourceIds.length ? lastAnswer.id : null);
    } finally {
      if (seq === openSeq.current) setLoadingConversation(false);
    }
  }, []);

  // Lần đầu: mở cuộc trò chuyện gần nhất (lịch sử hội thoại)
  const initialId = list.data?.[0]?.id;
  React.useEffect(() => {
    if (openedInitial.current || !list.data) return;
    openedInitial.current = true;
    // Đồng bộ với dữ liệu tải từ service (nguồn ngoài React)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialId) void open(initialId);
  }, [list.data, initialId, open]);

  const newChat = () => {
    openSeq.current += 1; // huỷ lần mở cuộc trò chuyện đang tải dở
    setLoadingConversation(false);
    setConversation(null);
    setSelectedId(null);
    setPending(null);
    setHistoryOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || pending?.status === "sending") return;
    setPending({ question: q, status: "sending" });
    setInput("");
    try {
      const r = await chatService.ask(conversation?.id ?? null, q);
      setConversation(r.conversation);
      setPending(null);
      setSelectedId(r.assistantMessage.sourceIds.length ? r.assistantMessage.id : null);
    } catch (e) {
      const timeout = e instanceof chatService.ChatTimeoutError;
      setPending({
        question: q,
        status: timeout ? "timeout" : "error",
        error: e instanceof Error ? e.message : "Trợ lý chưa trả lời được, bạn thử lại nhé.",
      });
    }
  };

  // Cuộn xuống cuối khi có tin nhắn mới
  const messageCount = (conversation?.messages.length ?? 0) + (pending ? 1 : 0);
  React.useEffect(() => {
    const el = logRef.current?.parentElement;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messageCount, pending?.status]);

  const messages = conversation?.messages ?? [];
  const selected = messages.find((m) => m.id === selectedId) ?? null;
  const selectedQuestion = selected
    ? (messages[messages.indexOf(selected) - 1]?.content ?? null)
    : null;
  const sending = pending?.status === "sending";

  return (
    <PageContainer>
      <div className="grid gap-4 md:gap-5 xl:h-[calc(100svh-64px-64px)] xl:min-h-[560px] xl:grid-cols-12 xl:gap-6">
        {/* Cột trái: hội thoại */}
        <section aria-labelledby="chat-title" className="flex min-h-[560px] flex-col rounded-xl border bg-card xl:col-span-7 xl:min-h-0">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 md:px-5">
            <div className="min-w-0">
              <h1 id="chat-title" className="flex items-center gap-2 text-xl leading-7 font-bold">
                <Bot aria-hidden className="size-6 text-primary" /> Trợ lý AI
              </h1>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Hỏi về thu chi của bạn. Số liệu do hệ thống tính trực tiếp từ giao dịch, AI chỉ diễn giải.
              </p>
            </div>
            <div className="flex gap-2">
              <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="max-md:h-11" disabled={!list.data}>
                    <History aria-hidden /> Lịch sử
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 rounded-xl p-1.5">
                  <p className="px-2.5 pt-1.5 pb-2 text-[13px] font-medium text-muted-foreground">Cuộc trò chuyện trước</p>
                  {list.data?.length ? (
                    <ul className="flex max-h-80 flex-col overflow-y-auto">
                      {list.data.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => open(c.id)}
                            aria-current={conversation?.id === c.id || undefined}
                            className={cn(
                              "flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-left transition-colors duration-150 hover:bg-row-hover",
                              conversation?.id === c.id && "bg-accent",
                            )}
                          >
                            <span className="w-full truncate text-sm font-medium">{c.title}</span>
                            <span className="text-xs text-muted-foreground">
                              <span className="num">{formatDate(c.updatedAt.slice(0, 10))}</span> · <span className="num">{c.questionCount}</span> câu hỏi
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-2.5 pb-2 text-sm text-muted-foreground">Chưa có cuộc trò chuyện nào.</p>
                  )}
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="sm" onClick={newChat} className="max-md:h-11">
                <SquarePen aria-hidden /> Trò chuyện mới
              </Button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-5">
            {list.error && !list.data ? (
              <ErrorState title="Không tải được lịch sử trò chuyện" error={list.error} onRetry={list.refetch} />
            ) : list.loading || loadingConversation ? (
              <div aria-hidden className="flex flex-col gap-4">
                <Skeleton className="ml-auto h-10 w-2/3 rounded-2xl" />
                <Skeleton className="h-28 w-3/4 rounded-2xl" />
                <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
                <Skeleton className="h-24 w-3/4 rounded-2xl" />
              </div>
            ) : messages.length === 0 && !pending ? (
              <div className="flex h-full flex-col items-center justify-center py-8 text-center">
                <span aria-hidden className="mb-3 inline-flex size-12 items-center justify-center rounded-full bg-accent text-primary">
                  <Bot className="size-6" />
                </span>
                <p className="text-[15px] font-semibold">Bạn muốn biết gì về chi tiêu của mình?</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">Chọn một câu hỏi mẫu hoặc tự gõ câu hỏi bên dưới.</p>
                <ul className="mt-4 flex max-w-lg flex-wrap justify-center gap-2" aria-label="Câu hỏi gợi ý">
                  {chatService.SUGGESTED_QUESTIONS.map((q) => (
                    <li key={q}>
                      <button
                        type="button"
                        onClick={() => send(q)}
                        className="h-9 rounded-full border bg-card px-3.5 text-sm transition-colors duration-150 hover:border-primary/40 hover:bg-accent max-md:h-11"
                      >
                        {q}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ol ref={logRef} role="log" aria-label="Hội thoại với trợ lý" aria-live="polite" className="flex flex-col gap-4">
                {messages.map((m) =>
                  m.role === "user" ? (
                    <UserBubble key={m.id} text={m.content} time={m.createdAt} />
                  ) : (
                    <AssistantBubble
                      key={m.id}
                      m={m}
                      selected={m.id === selectedId}
                      onSelect={() => setSelectedId(m.id === selectedId ? null : m.id)}
                    />
                  ),
                )}
                {pending && <UserBubble text={pending.question} failed={pending.status !== "sending"} />}
                {pending?.status === "sending" && (
                  <li className="flex items-start gap-2.5" aria-busy="true">
                    <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                      <Bot className="size-4" />
                    </span>
                    <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border bg-card px-4 py-3 text-sm text-muted-foreground">
                      <Loader2 aria-hidden className="size-4 animate-spin" />
                      Đang tra cứu dữ liệu của bạn…
                    </div>
                  </li>
                )}
                {pending && pending.status !== "sending" && (
                  <li className="flex items-start gap-2.5">
                    <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-expense-soft text-danger">
                      {pending.status === "timeout" ? <Clock className="size-4" /> : <CircleAlert className="size-4" />}
                    </span>
                    <div role="alert" className="max-w-[85%] rounded-2xl rounded-tl-md border border-danger/30 bg-card px-4 py-3">
                      <p className="text-sm font-medium">
                        {pending.status === "timeout" ? "Trợ lý trả lời quá lâu" : "Trợ lý chưa trả lời được"}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{pending.error}</p>
                      <div className="mt-2.5 flex gap-2">
                        <Button size="sm" onClick={() => send(pending.question)} className="max-md:h-11">
                          <RotateCw aria-hidden /> Thử lại
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setInput(pending.question);
                            setPending(null);
                            inputRef.current?.focus();
                          }}
                          className="max-md:h-11"
                        >
                          <X aria-hidden /> Sửa câu hỏi
                        </Button>
                      </div>
                    </div>
                  </li>
                )}
              </ol>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t px-4 py-3 md:px-5"
          >
            <label htmlFor="chat-input" className="sr-only">
              Câu hỏi cho trợ lý
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id="chat-input"
                ref={inputRef}
                rows={1}
                value={input}
                maxLength={chatService.QUESTION_MAX_LENGTH}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Ví dụ: Tháng này tiêu ăn uống bao nhiêu?"
                disabled={sending}
                aria-describedby="chat-hint"
                className="min-h-11 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-base leading-6 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-60 md:text-sm"
              />
              <Button type="submit" size="icon-lg" disabled={sending || !input.trim()} aria-label="Gửi câu hỏi" className="size-11">
                {sending ? <Loader2 aria-hidden className="animate-spin" /> : <SendHorizontal aria-hidden />}
              </Button>
            </div>
            <p id="chat-hint" className="mt-1.5 flex justify-between gap-2 text-xs text-muted-foreground">
              <span>Enter để gửi · Shift + Enter xuống dòng</span>
              {input.length > chatService.QUESTION_MAX_LENGTH - 50 && (
                <span className="num">
                  {input.length}/{chatService.QUESTION_MAX_LENGTH}
                </span>
              )}
            </p>
          </form>
        </section>

        {/* Cột phải: giao dịch nguồn */}
        <div className="min-h-[360px] xl:col-span-5 xl:min-h-0">
          <SourcesPanel message={selected} question={selectedQuestion} />
        </div>
      </div>
    </PageContainer>
  );
}
