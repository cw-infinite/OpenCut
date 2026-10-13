/** Every decode wait owns its listeners and deadline, including cancellation. */
export function mediaEvent(element: HTMLMediaElement | HTMLImageElement, event: string, action: () => void, signal: AbortSignal, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); element.removeEventListener(event, done); element.removeEventListener('error', failed); signal.removeEventListener('abort', aborted); };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('Could not decode media. Relink the source or import it again.')); };
    const aborted = () => { cleanup(); reject(new DOMException('Media preparation canceled', 'AbortError')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Media decoding timed out. Relink the source or import it again.')); }, timeoutMs);
    element.addEventListener(event, done, { once: true }); element.addEventListener('error', failed, { once: true }); signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted();
    else try { action(); } catch (error) { cleanup(); reject(error); }
  });
}
