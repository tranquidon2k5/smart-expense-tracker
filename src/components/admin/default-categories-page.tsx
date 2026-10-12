"use client";

import { ArrowDownLeft, ArrowUpRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import type { AdminCategoryRow, Category, TransactionType } from "@/types";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { CategoryIcon } from "@/components/category-icon";
import { ErrorState } from "@/components/error-state";
import { Panel } from "@/components/panel";
import { useServiceQuery } from "@/hooks/use-service-query";
import { adminService } from "@/services";
import { AdminHeader } from "./admin-shell";

const nf = new Intl.NumberFormat("vi-VN");

export function DefaultCategoriesPage() {
  const list = useServiceQuery(() => adminService.listDefaultCategories());
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Category | null>(null);
  const [formType, setFormType] = React.useState<TransactionType>("expense");
  const [deleting, setDeleting] = React.useState<AdminCategoryRow | null>(null);
  const [busy, setBusy] = React.useState(false);

  const openNew = (type: TransactionType) => {
    setEditing(null);
    setFormType(type);
    setFormOpen(true);
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await adminService.deleteDefaultCategory(deleting.id);
      toast.success(`Đã xoá danh mục “${deleting.name}”`);
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xoá được");
    } finally {
      setBusy(false);
    }
  };

  const section = (type: TransactionType) => {
    const rows = (list.data ?? []).filter((c) => c.type === type);
    const Icon = type === "income" ? ArrowDownLeft : ArrowUpRight;
    return (
      <Panel
        key={type}
        title={
          <span className="flex items-center gap-1.5">
            <Icon aria-hidden className={type === "income" ? "size-4 text-income" : "size-4 text-expense"} />
            {type === "income" ? "Danh mục thu" : "Danh mục chi"}
          </span>
        }
        className="p-0 md:p-0 [&>header]:mb-0 [&>header]:border-b [&>header]:px-4 [&>header]:py-3"
        action={
          <Button size="sm" variant="outline" onClick={() => openNew(type)}>
            <Plus aria-hidden /> Thêm
          </Button>
        }
      >
        {list.error ? (
          <ErrorState error={list.error} onRetry={list.refetch} />
        ) : (
          <Table aria-label={type === "income" ? "Danh mục thu mặc định" : "Danh mục chi mặc định"}>
            <TableHeader className="bg-surface-subtle">
              <TableRow className="hover:bg-transparent">
                <TableHead>Danh mục</TableHead>
                <TableHead>Màu</TableHead>
                <TableHead className="text-right">Đang dùng</TableHead>
                <TableHead className="w-24 text-right">
                  <span className="sr-only">Thao tác</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.loading
                ? Array.from({ length: type === "income" ? 3 : 8 }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : rows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                          <span className="font-medium">{c.name}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="num flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span aria-hidden className="size-3 rounded-sm" style={{ backgroundColor: c.color }} />
                          {c.color.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="num text-right">{c.usage ? `${nf.format(c.usage)} giao dịch` : "Chưa dùng"}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex gap-0.5">
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            aria-label={`Sửa ${c.name}`}
                            title={`Sửa ${c.name}`}
                            onClick={() => {
                              setEditing(c);
                              setFormType(c.type);
                              setFormOpen(true);
                            }}
                            className="max-md:size-9"
                          >
                            <Pencil aria-hidden />
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {/* Bọc span để tooltip vẫn hiện khi nút bị vô hiệu */}
                              <span tabIndex={c.usage ? 0 : -1} className="inline-flex rounded-md">
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  aria-label={`Xoá ${c.name}`}
                                  disabled={c.usage > 0}
                                  onClick={() => setDeleting(c)}
                                  className="text-danger hover:bg-expense-soft hover:text-danger max-md:size-9"
                                >
                                  <Trash2 aria-hidden />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{c.usage ? "Đang có giao dịch dùng danh mục này nên không xoá được" : `Xoá ${c.name}`}</TooltipContent>
                          </Tooltip>
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    );
  };

  return (
    <>
      <AdminHeader title="Danh mục mặc định" description="Mọi người dùng đều thấy các danh mục này. Danh mục đang có giao dịch chỉ đổi được tên, biểu tượng và màu." />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">{section("expense")}</div>
        <div className="xl:col-span-5">{section("income")}</div>
      </div>

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        defaultType={formType}
        scope="default"
        save={async (input, id) => {
          await adminService.saveDefaultCategory({ ...input, id });
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && !busy && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá danh mục mặc định “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Danh mục chưa có giao dịch nào. Sau khi xoá, người dùng sẽ không còn thấy danh mục này.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Giữ lại</AlertDialogCancel>
            <Button disabled={busy} onClick={() => void remove()} className="bg-danger text-white hover:bg-danger/90">
              {busy && <Loader2 aria-hidden className="motion-safe:animate-spin" />}
              Xoá danh mục
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
