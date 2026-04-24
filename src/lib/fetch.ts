/**
 * Thin fetch wrapper that redirects to /auth/signin on 401 responses.
 * Use this for all client-side API calls so expired sessions are handled gracefully.
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    window.location.href = "/auth/signin";
    throw new Error("Unauthorized");
  }
  return res;
}

/**
 * Shared SWR fetcher. Used by the global SWRConfig and by `preload()` callers
 * (e.g. hover prefetching) so that preloaded data lands in the same cache
 * that useSWR reads from.
 */
export async function swrFetcher<T>(url: string): Promise<T> {
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
  return res.json();
}
