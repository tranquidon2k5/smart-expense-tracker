import * as React from "react";

/** Tiêu đề trang thống nhất: h1 + mô tả + hành động bên phải */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl leading-8 font-bold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Khung trang chuẩn: lề, max-width, khoảng cách section (MASTER.md › Spacing) */
export function PageContainer({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-6 md:px-6 xl:gap-6 xl:px-8 xl:py-8">{children}</div>;
}
