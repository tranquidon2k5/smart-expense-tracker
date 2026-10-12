"use client";

import { Check } from "lucide-react";
import * as React from "react";
import type { AmountMode, CsvColumnMapping, ImportResult, ParsedCsv, Wallet } from "@/types";
import { PageContainer, PageHeader } from "@/components/page-header";
import { useServiceQuery } from "@/hooks/use-service-query";
import { importService, transactionService } from "@/services";
import { normalize } from "@/lib/text";
import { cn } from "@/lib/utils";
import { FileStep } from "./file-step";
import { MappingStep } from "./mapping-step";
import { ResultStep } from "./result-step";

const STEPS = ["Chọn file", "Ánh xạ cột", "Kết quả"] as const;
type Step = 1 | 2 | 3;
const EMPTY_MAPPING: CsvColumnMapping = { date: null, amount: null, description: null };

/** Đoán ví từ tên file: "sao-ke-techcombank.csv" → Techcombank. Không đoán được thì để người dùng chọn. */
function guessWallet(fileName: string, wallets: Wallet[] | undefined): string | null {
  const name = normalize(fileName).replace(/[^a-z0-9]/g, "");
  return wallets?.find((w) => name.includes(normalize(w.name).replace(/[^a-z0-9]/g, "")))?.id ?? null;
}

function Stepper({ step }: { step: Step }) {
  return (
    <nav aria-label="Các bước nhập sao kê">
      <ol className="flex items-center gap-2 md:gap-3">
        {STEPS.map((label, i) => {
          const n = (i + 1) as Step;
          const done = n < step;
          const current = n === step;
          return (
            <li key={label} aria-current={current ? "step" : undefined} className="flex items-center gap-2 md:gap-3">
              {i > 0 && <span aria-hidden className={cn("h-px w-6 md:w-12", done || current ? "bg-primary" : "bg-border")} />}
              <span
                aria-hidden
                className={cn(
                  "num inline-flex size-7 items-center justify-center rounded-full text-[13px] font-semibold",
                  done && "bg-primary text-primary-foreground",
                  current && "bg-accent text-primary ring-2 ring-primary",
                  !done && !current && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : n}
              </span>
              <span className={cn("text-sm", current ? "font-semibold" : "text-muted-foreground", !current && "max-sm:sr-only")}>
                <span className="sr-only">
                  Bước {n}
                  {done ? " (đã xong)" : ""}:{" "}
                </span>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Nhập sao kê CSV (F09, Luồng 2): Chọn file → Ánh xạ cột → Kết quả */
export function ImportPage() {
  const [step, setStep] = React.useState<Step>(1);
  const [parsed, setParsed] = React.useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = React.useState<CsvColumnMapping>(EMPTY_MAPPING);
  const [guessed, setGuessed] = React.useState<CsvColumnMapping>(EMPTY_MAPPING);
  const [amountMode, setAmountMode] = React.useState<AmountMode>("signed");
  /** Ví người dùng tự chọn; chưa chọn thì dùng ví đoán từ tên file (khi danh sách ví đã tải xong) */
  const [walletChoice, setWalletChoice] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [importError, setImportError] = React.useState<Error | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  const wallets = useServiceQuery(() => transactionService.listWallets());
  const walletId = walletChoice ?? (parsed ? guessWallet(parsed.fileName, wallets.data) : null);

  const goTo = (s: Step) => {
    setStep(s);
    // Đưa focus về đầu bước mới cho người dùng bàn phím / trình đọc màn hình
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const onParsed = (p: ParsedCsv | null) => {
    setParsed(p);
    if (!p) return;
    const g = importService.guessMapping(p);
    setMapping(g.mapping);
    setGuessed(g.mapping);
    setAmountMode(g.amountMode);
    setWalletChoice(null);
  };

  const runImport = async () => {
    if (!parsed || !walletId) return;
    setImporting(true);
    setImportError(null);
    try {
      const r = await importService.importTransactions({ file: parsed, mapping, amountMode, walletId });
      setResult(r);
      goTo(3);
    } catch (e) {
      setImportError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setImporting(false);
    }
  };

  const restart = () => {
    setParsed(null);
    setResult(null);
    setImportError(null);
    goTo(1);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Nhập sao kê"
        description="Đưa giao dịch từ file CSV của ngân hàng hoặc ví điện tử vào Sổ Tiền. Giao dịch trùng được bỏ qua, khoản AI chưa chắc sẽ chờ bạn duyệt."
      />
      <Stepper step={step} />
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        Bước {step}: {STEPS[step - 1]}
      </h2>

      {step === 1 && <FileStep parsed={parsed} onParsed={onParsed} onNext={() => goTo(2)} />}

      {step === 2 && parsed && (
        <>
          <MappingStep
            parsed={parsed}
            mapping={mapping}
            guessed={guessed}
            amountMode={amountMode}
            walletId={walletId}
            wallets={wallets.data}
            walletsLoading={wallets.loading}
            importing={importing}
            error={importError}
            onChange={(p) => {
              if (p.mapping) setMapping(p.mapping);
              if (p.amountMode) setAmountMode(p.amountMode);
              if (p.walletId) setWalletChoice(p.walletId);
            }}
            onBack={() => goTo(1)}
            onImport={runImport}
          />
        </>
      )}

      {step === 3 && result && <ResultStep result={result} onRestart={restart} />}
    </PageContainer>
  );
}
