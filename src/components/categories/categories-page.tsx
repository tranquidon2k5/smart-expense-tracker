"use client";

import { ArrowDownLeft, ArrowUpRight, Loader2, Lock, PencilLine, Plus, Shapes, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import type { Category, CategoryUsage, TransactionType } from "@/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryChip, CategoryIcon } from "@/components/category-icon";
import { ErrorState } from "@/components/error-state";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { useServiceQuery } from "@/hooks/use-service-query";
import { categoryService } from "@/services";
import { formatMoney } from "@/lib/format";
import { CategoryFormDialog } from "./category-form-dialog";

function CategoryList({
  type,
  items,
  onAdd,
  onEdit,
  onDelete,
}: {
  type: TransactionType;
  items: CategoryUsage[];
  onAdd: () => void;
  onEdit: (c: Category) => void;
  onDelete: (u: CategoryUsage) => void;
}) {
  const own = items.filter((i) => !i.isDefault);
  const Icon = type === "income" ? ArrowDownLeft : ArrowUpRight;
  return (
    <Panel
      title={
        <>
          {type === "income" ? "Khoản thu" : "Khoản chi"}{" "}
          <span className="num text-sm font-normal text-muted-foreground">({items.length})</span>
        </>
      }
      icon={<Icon aria-hidden className={type === "income" ? "size-5 text-income" : "size-5 text-expense"} />}
      action={
        <Button variant="outline" size="sm" onClick={onAdd} className="max-md:h-11">
          <Plus aria-hidden /> Thêm danh mục {type === "income" ? "thu" : "chi"}
        </Button>
      }
      className="p-0 md:p-0 [&>header]:px-4 [&>header]:pt-4 md:[&>header]:px-5 md:[&>header]:pt-5"
    >
      <ul className="border-t" aria-label={type === "income" ? "Danh mục thu" : "Danh mục chi"}>
        {items.map((u) => (
          <li
            key={u.category.id}
            className="group flex min-h-14 items-center gap-3 border-b px-4 py-2.5 transition-colors duration-150 last:border-0 hover:bg-row-hover md:px-5"
          >
            <CategoryIcon icon={u.category.icon} color={u.category.color} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-[15px] font-medium">
                {u.category.name}
                {u.isDefault && (
                  <span
                    className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                    title="Danh mục mặc định của hệ thống, không sửa hoặc xoá được"
                  >
                    <Lock aria-hidden className="size-3" /> Mặc định
                  </span>
                )}
              </p>
              <p className="text-[13px] text-muted-foreground">
                <span className="num">{u.transactionCount}</span> giao dịch
                {u.monthAmount > 0 && (
                  <>
                    {" "}
                    · tháng này <span className="num">{formatMoney(u.monthAmount)}</span>
                  </>
                )}
                {u.hasBudget && " · có ngân sách"}
              </p>
            </div>
            {!u.isDefault && (
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onEdit(u.category)}
                  aria-label={`Sửa danh mục ${u.category.name}`}
                  title="Sửa"
                  className="text-muted-foreground max-md:size-11"
                >
                  <PencilLine aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onDelete(u)}
                  aria-label={`Xoá danh mục ${u.category.name}`}
                  title="Xoá"
                  className="text-muted-foreground hover:bg-expense-soft hover:text-danger max-md:size-11"
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {own.length === 0 && (
        <div className="flex items-center gap-3 border-t bg-surface-subtle px-4 py-3 text-[13px] text-muted-foreground md:px-5">
          <Shapes aria-hidden className="size-4 shrink-0" />
          <span>
            Bạn chưa có danh mục {type === "income" ? "thu" : "chi"} riêng.{" "}
            <button type="button" onClick={onAdd} className="font-medium text-primary underline-offset-4 hover:underline">
              Tạo danh mục đầu tiên
            </button>
          </span>
        </div>
      )}
    </Panel>
  );
}

function DeleteCategoryDialog({
  target,
  all,
  onClose,
}: {
  target: CategoryUsage | null;
  all: CategoryUsage[];
  onClose: () => void;
}) {
  const [moveTo, setMoveTo] = React.useState<string>();
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastId, setLastId] = React.useState<string | null>(null);
  const used = !!target && (target.transactionCount > 0 || target.hasBudget);
  const options = all.filter((u) => target && u.category.type === target.category.type && u.category.id !== target.category.id);

  // Mặc định chuyển sang "Khác" / "Thu khác"
  const id = target?.category.id ?? null;
  if (id !== lastId) {
    setLastId(id);
    setError(null);
    setMoveTo(options.find((o) => o.category.id === (target?.category.type === "income" ? "c-income-other" : "c-other"))?.category.id);
  }

  const confirm = async () => {
    if (!target) return;
    if (used && !moveTo) return setError("Chọn danh mục để chuyển giao dịch sang.");
    setDeleting(true);
    try {
      const { moved } = await categoryService.deleteCategory(target.category.id, used ? moveTo : undefined);
      const dest = all.find((u) => u.category.id === moveTo)?.category.name;
      toast.success(`Đã xoá danh mục “${target.category.name}”`, {
        description: moved ? `${moved} giao dịch đã chuyển sang ${dest}.` : undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa xoá được, bạn thử lại nhé.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={!!target} onOpenChange={(o) => !o && !deleting && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xoá danh mục “{target?.category.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {used ? (
              <>
                Danh mục đang có <span className="num">{target?.transactionCount}</span> giao dịch
                {target?.hasBudget ? " và một hạn mức ngân sách" : ""}. Chọn danh mục để chuyển chúng sang trước khi xoá.
              </>
            ) : (
              "Danh mục chưa có giao dịch nào. Xoá xong không hoàn tác được."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {used && (
          <div>
            <label htmlFor="move-to" className="mb-1.5 block text-[13px] font-medium">
              Chuyển giao dịch sang
            </label>
            <Select value={moveTo} onValueChange={setMoveTo}>
              <SelectTrigger id="move-to" className="w-full">
                <SelectValue placeholder="Chọn danh mục" />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.category.id} value={o.category.id}>
                    <CategoryChip name={o.category.name} color={o.category.color} className="text-sm" />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Giữ lại</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={(e) => {
              e.preventDefault();
              confirm();
            }}
          >
            {deleting && <Loader2 aria-hidden className="animate-spin" />}
            {used ? "Chuyển và xoá" : "Xoá danh mục"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CategoriesPage() {
  const query = useServiceQuery(() => categoryService.listCategoryUsage());
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Category | null>(null);
  const [formType, setFormType] = React.useState<TransactionType>("expense");
  const [deleting, setDeleting] = React.useState<CategoryUsage | null>(null);
  const data = query.data ?? [];

  const openCreate = (type: TransactionType) => {
    setEditing(null);
    setFormType(type);
    setFormOpen(true);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Danh mục"
        description="Danh mục mặc định dùng chung cho mọi người. Thêm danh mục riêng để phân loại theo cách của bạn."
        actions={
          <Button onClick={() => openCreate("expense")} className="max-md:h-11">
            <Plus aria-hidden /> Thêm danh mục
          </Button>
        }
      />

      {query.error && !query.data ? (
        <section className="rounded-xl border bg-card">
          <ErrorState title="Không tải được danh mục" error={query.error} onRetry={query.refetch} className="min-h-[360px]" />
        </section>
      ) : query.loading ? (
        <div aria-hidden className="grid gap-4 md:gap-5 xl:grid-cols-2 xl:gap-6">
          {[0, 1].map((k) => (
            <div key={k} className="rounded-xl border bg-card p-5">
              <Skeleton className="mb-4 h-6 w-40" />
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid items-start gap-4 md:gap-5 xl:grid-cols-2 xl:gap-6">
          {(["expense", "income"] as const).map((t) => (
            <CategoryList
              key={t}
              type={t}
              items={data.filter((u) => u.category.type === t)}
              onAdd={() => openCreate(t)}
              onEdit={(c) => {
                setEditing(c);
                setFormType(c.type);
                setFormOpen(true);
              }}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      <CategoryFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} defaultType={formType} />
      <DeleteCategoryDialog target={deleting} all={data} onClose={() => setDeleting(null)} />
    </PageContainer>
  );
}
