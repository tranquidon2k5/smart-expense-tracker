"use client";

import { Loader2, Lock, LockOpen, Search, Users } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import type { AdminUserRow } from "@/types";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Panel } from "@/components/panel";
import { useServiceQuery } from "@/hooks/use-service-query";
import { useSession } from "@/hooks/use-session";
import { adminService, transactionService } from "@/services";
import { formatDate } from "@/lib/format";
import { normalize } from "@/lib/text";
import { cn } from "@/lib/utils";
import { AdminHeader } from "./admin-shell";

type Filter = "all" | "active" | "inactive" | "locked";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "active", label: "Hoạt động 7 ngày" },
  { value: "inactive", label: "Lâu không vào" },
  { value: "locked", label: "Bị khoá" },
];

const nf = new Intl.NumberFormat("vi-VN");

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export function UsersPage() {
  const session = useSession();
  const users = useServiceQuery(() => adminService.listUsers());
  const today = transactionService.getToday();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [target, setTarget] = React.useState<AdminUserRow | null>(null);
  const [saving, setSaving] = React.useState(false);

  const inactive = (u: AdminUserRow) => !u.lastActiveDate || daysBetween(u.lastActiveDate, today) > 7;
  const q = normalize(query.trim());
  const rows = (users.data ?? []).filter((u) => {
    if (q && !normalize(`${u.fullName} ${u.email}`).includes(q)) return false;
    if (filter === "locked") return u.isLocked;
    if (filter === "active") return !u.isLocked && !inactive(u);
    if (filter === "inactive") return !u.isLocked && inactive(u);
    return true;
  });
  const count = (f: Filter) =>
    (users.data ?? []).filter((u) => (f === "locked" ? u.isLocked : f === "active" ? !u.isLocked && !inactive(u) : f === "inactive" ? !u.isLocked && inactive(u) : true)).length;

  const confirm = async () => {
    if (!target) return;
    setSaving(true);
    try {
      await adminService.setUserLocked(target.id, !target.isLocked);
      toast.success(target.isLocked ? `Đã mở khoá ${target.fullName}` : `Đã khoá ${target.fullName}`, {
        description: target.isLocked ? "Người dùng đăng nhập lại được ngay." : "Người dùng không đăng nhập được cho tới khi được mở khoá. Dữ liệu vẫn giữ nguyên.",
      });
      setTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không cập nhật được");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdminHeader
        title="Người dùng"
        description={users.data ? `${nf.format(users.data.length)} tài khoản · khoá tài khoản không xoá dữ liệu` : "Xem và khoá / mở khoá tài khoản"}
      />

      <Panel className="p-0 md:p-0">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
          <div className="relative w-full sm:w-72">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên hoặc email"
              aria-label="Tìm người dùng theo tên hoặc email"
              className="h-8 pl-8 text-[13px] max-md:h-10"
            />
          </div>
          <div role="group" aria-label="Lọc người dùng" className="inline-flex flex-wrap rounded-lg bg-muted p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "h-7 rounded-md px-2.5 text-[13px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-md:h-9",
                  filter === f.value ? "bg-card text-foreground shadow-[0_1px_2px_rgb(19_42_38/0.08)]" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
                {users.data && <span className="num ml-1 text-muted-foreground">{count(f.value)}</span>}
              </button>
            ))}
          </div>
        </div>

        {users.error ? (
          <ErrorState error={users.error} onRetry={users.refetch} />
        ) : (
          <Table aria-label="Danh sách người dùng" aria-busy={users.loading}>
            <TableHeader className="bg-surface-subtle">
              <TableRow className="hover:bg-transparent">
                <TableHead>Họ tên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Tham gia</TableHead>
                <TableHead>Hoạt động gần nhất</TableHead>
                <TableHead className="text-right">Giao dịch</TableHead>
                <TableHead className="text-right">Chuỗi</TableHead>
                <TableHead className="text-right">Lượt AI</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-28 text-right">
                  <span className="sr-only">Thao tác</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.loading
                ? Array.from({ length: 10 }, (_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 10 }, (_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : rows.map((u) => {
                    const self = u.id === session?.userId;
                    const days = u.lastActiveDate ? daysBetween(u.lastActiveDate, today) : null;
                    return (
                      <TableRow key={u.id} className={cn(u.isLocked && "bg-muted/60")}>
                        <TableCell className="max-w-[200px] truncate font-medium" title={u.fullName}>
                          {u.fullName}
                          {self && <span className="font-normal text-muted-foreground"> (bạn)</span>}
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-muted-foreground" title={u.email}>
                          {u.email}
                        </TableCell>
                        <TableCell>{u.role === "admin" ? "Quản trị" : "Người dùng"}</TableCell>
                        <TableCell className="num">{formatDate(u.createdAt.slice(0, 10))}</TableCell>
                        <TableCell className="num">
                          {days === null ? "—" : days === 0 ? "Hôm nay" : days === 1 ? "Hôm qua" : `${days} ngày trước`}
                        </TableCell>
                        <TableCell className="num text-right">{nf.format(u.transactionCount)}</TableCell>
                        <TableCell className="num text-right">{u.currentStreak ? `${u.currentStreak} ngày` : "—"}</TableCell>
                        <TableCell className="num text-right">{nf.format(u.aiCalls)}</TableCell>
                        <TableCell>
                          {u.isLocked ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-expense-soft px-1.5 py-0.5 text-xs font-medium text-danger">
                              <Lock aria-hidden className="size-3" /> Bị khoá
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <span aria-hidden className="size-1.5 rounded-full bg-success" /> Hoạt động
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {u.role !== "admin" && (
                            <Button
                              size="xs"
                              variant={u.isLocked ? "outline" : "ghost"}
                              onClick={() => setTarget(u)}
                              aria-label={`${u.isLocked ? "Mở khoá" : "Khoá"} tài khoản ${u.fullName}`}
                              className={cn(!u.isLocked && "text-danger hover:bg-expense-soft hover:text-danger", "max-md:h-9")}
                            >
                              {u.isLocked ? <LockOpen aria-hidden /> : <Lock aria-hidden />}
                              {u.isLocked ? "Mở khoá" : "Khoá"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        )}
        {!users.loading && !users.error && rows.length === 0 && (
          <EmptyState icon={Users} className="py-10" title="Không có người dùng phù hợp" description="Thử từ khoá khác hoặc bỏ bộ lọc." />
        )}
      </Panel>

      <AlertDialog open={!!target} onOpenChange={(o) => !o && !saving && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {target?.isLocked ? "Mở khoá" : "Khoá"} tài khoản {target?.fullName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {target?.isLocked
                ? `${target?.email} sẽ đăng nhập lại được ngay.`
                : `${target?.email} sẽ không đăng nhập được cho tới khi được mở khoá. Dữ liệu của họ vẫn giữ nguyên, không bị xoá.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Huỷ</AlertDialogCancel>
            <Button
              disabled={saving}
              onClick={() => void confirm()}
              className={cn(!target?.isLocked && "bg-danger text-white hover:bg-danger/90")}
            >
              {saving && <Loader2 aria-hidden className="motion-safe:animate-spin" />}
              {target?.isLocked ? "Mở khoá" : "Khoá tài khoản"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
