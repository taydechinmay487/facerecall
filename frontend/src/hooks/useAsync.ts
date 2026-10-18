import { useCallback, useEffect, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
}

export function useAsync<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> & { reload: () => void; setData: (data: T) => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  const setData = useCallback((data: T) => setState({ data, error: null, loading: false }), []);

  useEffect(() => {
    const controller = new AbortController();
    // Keep previous data visible while refetching to avoid layout jumps.
    setState((current) => ({ ...current, loading: true, error: null }));
    loader(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if ((error as Error)?.name === "AbortError") return;
        setState((current) => ({ ...current, error, loading: false }));
      });
    return () => controller.abort();
    // `loader` is intentionally not a dependency: callers declare their inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { ...state, reload, setData };
}
