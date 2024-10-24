export interface VisualObserverEntry {
  target: Element;
  contentRect: DOMRectReadOnly;
  isAppearing: boolean;
}

export interface VisualObserverCallback {
  (this: VisualObserver, entries: VisualObserverEntry[], observer: VisualObserver): void;
}

interface VisualObserverElement {
  io: IntersectionObserver | null;
  threshold: number;
  isFirstUpdate: boolean;
}

/**
 * Create an observer that notifies when an element is resized, moved, or added/removed from the DOM.
 */
export class VisualObserver {
  #root = document.documentElement;
  #rootRect = this.#root.getBoundingClientRect();

  #entries: VisualObserverEntry[] = [];
  #rafId = 0;

  #callback: VisualObserverCallback;

  constructor(callback: VisualObserverCallback) {
    this.#callback = callback;
  }

  #elements = new Map<Element, VisualObserverElement>();

  #resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
    const rootEntry = entries.find((entry) => entry.target === this.#root);
    // Any time the root element resizes we need to refresh all the observed elements.
    if (rootEntry !== undefined) {
      this.#rootRect = rootEntry.contentRect;

      this.#elements.forEach((_, target) => {
        // Why force a refresh? we really just need to reset the IntersectionObserver?
        this.#appendEntry(this.#refreshElement(target));
      });
    } else {
      for (const entry of entries) {
        this.#appendEntry(this.#refreshElement(entry.target));
      }
    }
  });

  #appendEntry(entry: VisualObserverEntry) {
    // deduplicate the same target
    this.#entries.push(entry);

    if (this.#rafId === 0) {
      this.#rafId = requestAnimationFrame(this.#flush);
    }
  }

  #flush = () => {
    const entries = this.#entries;
    this.#entries = [];
    this.#rafId = 0;
    this.#callback(entries, this);
  };

  // We should be guaranteed that each `IntersectionObserver` only observes one element.
  #onIntersection = ([
    { target, intersectionRatio, boundingClientRect },
  ]: IntersectionObserverEntry[]) => {
    const el = this.#elements.get(target);

    if (el === undefined) return;

    if (intersectionRatio !== el.threshold) {
      // It's possible for the watched element to not be at perfect 1.0 visibility when we create
      // the IntersectionObserver. This has a couple of causes:
      //   - elements being on partial pixels
      //   - elements being hidden offscreen (e.g., <html> has `overflow: hidden`)
      //   - delays: if your DOM change occurs due to e.g., page resize, you can see elements
      //     behind their actual position
      //
      // In all of these cases, refresh but with this lower ratio of threshold. When the element
      // moves beneath _that_ new value, the user will get notified.

      if (el.isFirstUpdate) {
        el.threshold =
          intersectionRatio === 0.0
            ? 0.0000001 // just needs to be non-zero
            : intersectionRatio;
      }

      this.#appendEntry(this.#refreshElement(target, boundingClientRect));
    }

    el.isFirstUpdate = false;
  };

  #refreshElement(
    target: Element,
    contentRect: DOMRectReadOnly = target.getBoundingClientRect()
  ): VisualObserverEntry {
    // Assume el exists
    const el = this.#elements.get(target)!;

    el.io?.disconnect();
    el.io = null;

    const { left, top, height, width } = contentRect;

    // Don't create a IntersectionObserver until the target has a size.
    if (width === 0 && height === 0) {
      return {
        target,
        contentRect,
        isAppearing: false,
      };
    }

    const root = this.#root;
    const floor = Math.floor;
    const x = left + root.scrollLeft;
    const y = top + root.scrollTop;

    // `${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px`;
    const rootMargin = `${-floor(y)}px ${-floor(this.#rootRect.width - (x + width))}px ${-floor(
      this.#rootRect.height - (y + height)
    )}px ${-floor(x)}px`;

    // Reset the threshold and isFirstUpdate before creating a new Intersection Observer.
    const { threshold } = el;
    el.threshold = 1;
    el.isFirstUpdate = true;

    el.io = new IntersectionObserver(this.#onIntersection, {
      root,
      rootMargin,
      threshold,
    });

    el.io.observe(target);

    return {
      target,
      contentRect: DOMRectReadOnly.fromRect({
        x,
        y,
        width,
        height,
      }),
      isAppearing: true,
    };
  }

  disconnect(): void {
    this.#elements.forEach((el) => el.io?.disconnect());
    this.#elements.clear();
    this.#resizeObserver.disconnect();
  }

  observe(target: Element): void {
    if (this.#elements.has(target)) return;

    if (this.#elements.size === 0) {
      this.#resizeObserver.observe(this.#root);
    }

    this.#elements.set(target, {
      io: null,
      threshold: 1,
      isFirstUpdate: true,
    });

    // The resize observer will be called immediately, so we don't have to manually refresh.
    this.#resizeObserver.observe(target);
  }

  takeRecords(): VisualObserverEntry[] {
    if (this.#rafId === 0) return [];

    const entries = this.#entries;
    this.#entries = [];
    cancelAnimationFrame(this.#rafId);
    this.#rafId = 0;
    return entries;
  }

  unobserve(target: Element): void {
    const el = this.#elements.get(target);

    if (el === undefined) return;

    this.#resizeObserver.unobserve(target);

    el.io?.disconnect();

    this.#elements.delete(target);

    if (this.#elements.size === 0) {
      this.#resizeObserver.disconnect();
    }
  }
}

export type VisualObserverEntryCallback = (entry: VisualObserverEntry) => void;

export class VisualObserverManager {
  #elementMap = new WeakMap<Element, Set<VisualObserverEntryCallback>>();

  #vo = new VisualObserver((entries) => {
    for (const entry of entries) {
      const callbacks = this.#elementMap.get(entry.target);

      if (callbacks) {
        callbacks.forEach((callback) => callback(entry));
      }
    }
  });

  observe(target: Element, callback: VisualObserverEntryCallback): void {
    let callbacks = this.#elementMap.get(target);

    if (callbacks === undefined) {
      this.#vo.observe(target);
      this.#elementMap.set(target, (callbacks = new Set()));
    } else {
      callback({ target, contentRect: target.getBoundingClientRect(), isAppearing: true });
    }

    callbacks.add(callback);
  }

  unobserve(target: Element, callback: VisualObserverEntryCallback): void {
    let callbacks = this.#elementMap.get(target);

    if (callbacks === undefined) return;

    callbacks.delete(callback);

    if (callbacks.size === 0) {
      this.#vo.unobserve(target);
      this.#elementMap.delete(target);
    }
  }
}
