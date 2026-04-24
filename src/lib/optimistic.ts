import { mutate as globalMutate, type Arguments, type MutatorOptions } from "swr";

type OptimisticOptions<TCache, TResponse> = {
  key: Arguments;
  optimisticData: NonNullable<MutatorOptions<TCache>["optimisticData"]>;
  request: () => Promise<TResponse>;
  /** Transform the server response into the cache shape. Omit when TResponse === TCache. */
  reconcile?: (response: TResponse) => TCache;
};

/**
 * SWR optimistic-mutation helper. Writes `optimisticData` to the cache immediately,
 * runs `request()`, then populates the cache with `reconcile(response)` (or the raw
 * response when `reconcile` is omitted). On error, the cache rolls back to its prior
 * value and the error is re-thrown so callers can `toast.error(...)`.
 *
 * SWR's own mutate returns the cache shape — this helper also returns the HTTP response
 * shape separately, because they're often different (e.g. cache is a full workout, response
 * is `{ id }`).
 */
export async function optimisticMutate<TCache, TResponse>(
  opts: OptimisticOptions<TCache, TResponse>,
): Promise<TResponse> {
  let responseRef: TResponse | undefined;
  await globalMutate<TCache>(
    opts.key,
    async () => {
      const response = await opts.request();
      responseRef = response;
      return opts.reconcile
        ? opts.reconcile(response)
        : (response as unknown as TCache);
    },
    {
      optimisticData: opts.optimisticData,
      rollbackOnError: true,
      populateCache: true,
      revalidate: false,
    },
  );
  return responseRef as TResponse;
}
