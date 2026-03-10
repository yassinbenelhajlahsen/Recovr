import { useState, useRef, useEffect, useCallback } from "react";
import type { Exercise } from "@/types/workout";

export function useExerciseSearch() {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Exercise[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);

  const searchPanelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchCache = useRef<Map<string, Exercise[]>>(new Map());
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchExercises = useCallback(async (q: string) => {
    const cached = searchCache.current.get(q);
    if (cached) {
      setSearchResults(cached);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/exercises?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      searchCache.current.set(q, data);
      setSearchResults(data);
    } catch {
      /* ignore */
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!showSearch) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchExercises(searchQuery), 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery, showSearch, fetchExercises]);

  // Open search: load results + focus
  useEffect(() => {
    if (showSearch) {
      fetchExercises(searchQuery);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSearch]);

  // Close on outside click
  useEffect(() => {
    if (!showSearch) return;
    const handle = (e: MouseEvent) => {
      if (!searchPanelRef.current?.contains(e.target as Node)) {
        setShowSearch(false);
        setSearchQuery("");
        setShowCustomForm(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showSearch]);

  function openSearch() {
    setShowSearch(true);
  }

  function closeSearch() {
    setShowSearch(false);
    setSearchQuery("");
    setShowCustomForm(false);
  }

  function clearCache() {
    searchCache.current.clear();
  }

  return {
    showSearch,
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    searchPanelRef,
    searchInputRef,
    showCustomForm,
    setShowCustomForm,
    openSearch,
    closeSearch,
    fetchExercises,
    clearCache,
  };
}
