"use client";

import * as React from "react";
import { onDataChanged } from "@/services";

export interface QueryState<T> {
  data: T | undefined;
  /** true chỉ ở lần tải đầu — các lần làm mới giữ dữ liệu cũ, không nháy skeleton */
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

/** Gọi một hàm service, tự tải lại khi dữ liệu thay đổi (vd. vừa ghi giao dịch). */
export function useServiceQuery<T>(fetcher: () => Promise<T>): QueryState<T> {
  const [data, setData] = React.useState<T>();
  const [error, setError] = React.useState<Error>();
  const [loading, setLoading] = React.useState(true);
  const fetcherRef = React.useRef(fetcher);
  React.useLayoutEffect(() => {
    fetcherRef.current = fetcher;
  });

  const run = React.useCallback(() => {
    let cancelled = false;
    fetcherRef
      .current()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(undefined);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancel = run();
    const unsubscribe = onDataChanged(() => {
      cancel();
      cancel = run();
    });
    return () => {
      cancel();
      unsubscribe();
    };
  }, [run]);

  return { data, loading, error, refetch: run };
}
