// Keep the worker compatible with Safari versions without Promise.withResolvers.
if (typeof Promise.withResolvers !== 'function') {
  Object.defineProperty(Promise, 'withResolvers', {
    value: function () {
      let resolve;
      let reject;
      const promise = new Promise((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
      });
      return { promise, resolve, reject };
    },
  });
}

await import('./pdf.worker.min.mjs?v=6.3.289');
