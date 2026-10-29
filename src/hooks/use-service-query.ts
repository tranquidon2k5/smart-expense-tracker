"use client";

import * as React from "react";
import { onDataChanged } from "@/services";
import { localizeData } from "@/i18n/content";

export interface QueryState<T> {
  data: T | undefined;
  /** true khi chưa có dữ liệu nào (lần tải đầu) — hiện skeleton */
  loading: boolean;
  /** true mỗi khi đang gọi lại (đổi bộ lọc, dữ liệu thay đổi) — giữ dữ liệu cũ, không nháy skeleton */
  fetching: boolean;
  error: Error | undefined;
  refetch: () => void;
}

/**
 * Gọi một hàm service, tự tải lại khi dữ liệu thay đổi (vd. vừa ghi giao dịch)
 * hoặc khi `key` đổi (vd. bộ lọc). `key` nên là chuỗi mô tả tham số của fetcher.
 *
 * Tên mặc định trong dữ liệu (danh mục, nhiệm vụ, huy hiệu…) được dịch theo ngôn ngữ giao diện;
 * trang Quản trị truyền `{ raw: true }` để sửa đúng bản gốc trong database.
 */
export function useServiceQuery<T>(fetcher: () => Promise<T>, key = "", options: { raw?: boolean } = {}): QueryState<T> {
  const [data, setData] = React.useState<T>();
  const [error, setError] = React.useState<Error>();
  const [fetching, setFetching] = React.useState(true);
  const fetcherRef = React.useRef(fetcher);
  const runIdRef = React.useRef(0);
  const rawRef = React.useRef(options.raw);
  React.useLayoutEffect(() => {
    fetcherRef.current = fetcher;
  });

  const run = React.useCallback(() => {
    const runId = ++runIdRef.current;
    setFetching(true);
    fetcherRef
      .current()
      .then((result) => {
        if (runId !== runIdRef.current) return;
        setData(rawRef.current ? result : localizeData(result));
        setError(undefined);
      })
      .catch((e: unknown) => {
        if (runId !== runIdRef.current) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (runId === runIdRef.current) setFetching(false);
      });
  }, []);

  React.useEffect(() => {
    // Gọi lại khi key đổi; bỏ kết quả của lần gọi cũ (runId)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ với nguồn dữ liệu ngoài (service)
    run();
    return onDataChanged(run);
  }, [run, key]);

  React.useEffect(
    () => () => {
      runIdRef.current += 1;
    },
    [],
  );

  return { data, loading: data === undefined && fetching && !error, fetching, error, refetch: run };
}
