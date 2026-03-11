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
