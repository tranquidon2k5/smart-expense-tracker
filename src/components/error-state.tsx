import { CircleAlert, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  error?: Error;
  onRetry?: () => void;
  className?: string;
}

/** Trạng thái lỗi: nói rõ chuyện gì xảy ra + nút Thử lại (không đổ lỗi cho người dùng) */
export function ErrorState({ title = "Không tải được dữ liệu", error, onRetry, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn("flex flex-1 flex-col items-center justify-center px-4 py-10 text-center", className)}>
      <span aria-hidden className="mb-3 inline-flex size-11 items-center justify-center rounded-full bg-expense-soft text-danger">
        <CircleAlert className="size-5" />
      </span>
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {error?.message ?? "Đã có lỗi xảy ra. Bạn thử lại sau ít phút nhé."}
      </p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-4">
          <RotateCw aria-hidden /> Thử lại
        </Button>
      )}
    </div>
  );
}
