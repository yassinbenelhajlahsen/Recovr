"use client";

import useSWRInfinite from "swr/infinite";
import type { SuggestionHistoryItem } from "@/types/suggestion";

type HistoryPage = {
  suggestions: SuggestionHistoryItem[];
  hasMore: boolean;
};

export const PAGE_SIZE = 20;

export function useSuggestionHistory() {
  const getKey = (pageIndex: number, previousPageData: HistoryPage | null) => {
    if (previousPageData && !previousPageData.hasMore) return null;
    if (pageIndex === 0) return `/api/suggest/history?limit=${PAGE_SIZE}`;
    const lastItem = previousPageData!.suggestions.at(-1);
    if (!lastItem) return null;
    return `/api/suggest/history?limit=${PAGE_SIZE}&cursor=${lastItem.created_at}`;
  };

  const { data, error, size, setSize, isLoading, isValidating } =
    useSWRInfinite<HistoryPage>(getKey, {
      dedupingInterval: 30_000,
      revalidateFirstPage: false,
    });

  const suggestions = data?.flatMap((page) => page.suggestions) ?? [];
  const hasMore = data?.[data.length - 1]?.hasMore ?? false;
  const isEmpty = data?.[0]?.suggestions.length === 0;

  return {
    suggestions,
    hasMore,
    isEmpty,
    isLoading,
    isLoadingMore: isValidating && size > 1,
    loadMore: () => setSize(size + 1),
    error: error?.message ?? null,
  };
}
