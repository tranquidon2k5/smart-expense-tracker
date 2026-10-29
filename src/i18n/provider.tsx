"use client";

import * as React from "react";
import {
  DEFAULT_LOCALE,
  getStoredLocale,
  setActiveLocale,
  setStoredLocale,
  subscribeLocale,
  type Locale,
  type MessageTree,
  type Messages,
} from "./core";
import { syncDocumentTitle } from "./document-title";

const LocaleContext = React.createContext<Locale>(DEFAULT_LOCALE);

const getServerSnapshot = () => DEFAULT_LOCALE;

/**
 * Đặt ngôn ngữ cho toàn bộ cây. Lúc prerender và hydrate luôn là tiếng Việt (khớp HTML từ server);
 * ngay sau đó đọc ngôn ngữ đã lưu. Đổi ngôn ngữ thì mount lại cây con (`key`) để mọi chuỗi, kể cả chuỗi
 * do hàm định dạng ngoài React tạo ra, được tính lại — chỉ xảy ra khi người dùng đổi trong Cài đặt.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = React.useSyncExternalStore(subscribeLocale, getStoredLocale, getServerSnapshot);
  // Đặt trong lúc render, trước khi các con render: giá trị suy ra hoàn toàn từ `locale` nên an toàn
  setActiveLocale(locale);

  React.useEffect(() => {
    document.documentElement.lang = locale;
    return syncDocumentTitle(locale);
  }, [locale]);

  return (
    <LocaleContext.Provider value={locale}>
      <React.Fragment key={locale}>{children}</React.Fragment>
    </LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return React.useContext(LocaleContext);
}

export function useSetLocale(): (locale: Locale) => void {
  return setStoredLocale;
}

/** Câu chữ của một tính năng theo ngôn ngữ hiện tại */
export function useT<T extends MessageTree>(messages: Messages<T>): Messages<T>["vi"] {
  return messages[useLocale()];
}
