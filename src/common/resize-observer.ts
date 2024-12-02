export type ResizeObserverEntryCallback = (entry: ResizeObserverEntry) => void;

export class ResizeObserverManager {
  #elementMap = new WeakMap<Element, Set<ResizeObserverEntryCallback>>();
  #elementEntry = new WeakMap<Element, ResizeObserverEntry>();

  #vo = new ResizeObserver((entries) => {
    for (const entry of entries) {
      this.#elementEntry.set(entry.target, entry);
      this.#elementMap.get(entry.target)?.forEach((callback) => callback(entry));
    }
  });

  observe(target: Element, callback: ResizeObserverEntryCallback): void {
    let callbacks = this.#elementMap.get(target);

    if (callbacks === undefined) {
      this.#vo.observe(target);
      this.#elementMap.set(target, (callbacks = new Set()));
    } else {
      const entry = this.#elementEntry.get(target);
      if (entry) {
        callback(entry);
      }
    }

    callbacks.add(callback);
  }

  unobserve(target: Element, callback: ResizeObserverEntryCallback): void {
    const callbacks = this.#elementMap.get(target);

    if (callbacks === undefined) return;

    callbacks.delete(callback);

    if (callbacks.size === 0) {
      this.#vo.unobserve(target);
      this.#elementMap.delete(target);
    }
  }
}
