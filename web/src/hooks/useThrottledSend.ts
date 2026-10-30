import { useRef } from 'react';

/**
 * Wraps `send` so rapid calls (a slider being dragged) go out at most every
 * `gapMs`, always finishing with the latest value. `pending()` says whether a
 * value is still on its way, so the UI doesn't snap back to stale server data.
 */
export function useThrottledSend<T>(send: (value: T) => Promise<unknown>, gapMs = 150) {
  const latest = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sendRef = useRef(send);
  sendRef.current = send;

  const flush = async () => {
    const next = latest.current;
    latest.current = null;
    if (!next) {
      timer.current = undefined;
      return;
    }
    await sendRef.current(next.value).catch(() => {});
    timer.current = setTimeout(flush, gapMs);
  };

  return {
    push(value: T) {
      latest.current = { value };
      if (!timer.current) timer.current = setTimeout(flush, 0);
    },
    pending: () => latest.current !== null,
  };
}
