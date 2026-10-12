import * as React from "react";
import { cn } from "@/lib/utils";

interface PanelProps extends Omit<React.ComponentProps<"section">, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Nút/hành động bên phải tiêu đề */
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

/** Card phẳng của MASTER.md: nền trắng, viền 1px, bo 12px, không bóng. Không lồng Panel. */
export function Panel({ title, description, action, icon, className, children, ...props }: PanelProps) {
  const titleId = React.useId();
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={cn("flex min-w-0 flex-col rounded-xl border bg-card p-4 md:p-5", className)}
      {...props}
    >
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 id={titleId} className="flex items-center gap-2 text-lg leading-[26px] font-semibold">
                {icon}
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-[13px] leading-[18px] text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
