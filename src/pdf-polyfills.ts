// PDF.js 6 still calls these APIs in its legacy build on older Safari releases.
if (typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers !== 'function') {
  Object.defineProperty(Promise, 'withResolvers', {
    value: function <T>() {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
      });
      return { promise, resolve, reject };
    },
  });
}

if (typeof AbortSignal.any !== 'function') {
  Object.defineProperty(AbortSignal, 'any', {
    value: (signals: AbortSignal[]) => {
      const controller = new AbortController();
      const abort = (signal: AbortSignal) => controller.abort(signal.reason);
      for (const signal of signals) {
        if (signal.aborted) {
          abort(signal);
          break;
        }
        signal.addEventListener('abort', () => abort(signal), { once: true, signal: controller.signal });
      }
      return controller.signal;
    },
  });
}
