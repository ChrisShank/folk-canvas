const callbacks = new Set<FrameRequestCallback>();
let rAFId = -1;

function onRAF(time: DOMHighResTimeStamp) {
  rAFId = -1;
  const values = Array.from(callbacks);
  callbacks.clear();
  values.forEach((callback) => callback(time));
}

// Batch multiple callbacks into a single rAF for better performance
export function requestAnimationFrame(callback: FrameRequestCallback) {
  if (callbacks.size === 0) {
    rAFId = window.requestAnimationFrame(onRAF);
  }

  callbacks.add(callback);
}

export function cancelAnimationFrame(callback: FrameRequestCallback) {
  callbacks.delete(callback);

  if (callbacks.size === 0) {
    window.cancelAnimationFrame(rAFId);
  }
}
