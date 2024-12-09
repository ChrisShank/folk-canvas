import { FolkShape } from '../folk-shape';
import { ClientRectObserver, ClientRectObserverEntry } from './client-rect-observer';
import { TransformEvent } from './TransformEvent';

export type ClientRectObserverEntryCallback = (entry: ClientRectObserverEntry) => void;

export class FolkObserver {
  static #instance: FolkObserver | null = null;

  // singleton so we only observe elements once
  constructor() {
    if (FolkObserver.#instance === null) {
      FolkObserver.#instance = this;
    }
    return FolkObserver.#instance;
  }

  #elementMap = new WeakMap<Element, Set<ClientRectObserverEntryCallback>>();

  #vo = new ClientRectObserver((entries) => {
    for (const entry of entries) {
      this.#updateTarget(entry);
    }
  });

  #updateTarget(entry: ClientRectObserverEntry) {
    const callbacks = this.#elementMap.get(entry.target);

    if (callbacks) {
      callbacks.forEach((callback) => callback(entry));
    }
  }

  #onTransform = (event: TransformEvent) => {
    this.#updateTarget({ target: event.target as HTMLElement, contentRect: event.current });
  };

  observe(target: Element, callback: ClientRectObserverEntryCallback): void {
    let callbacks = this.#elementMap.get(target);

    const isFolkShape = target instanceof FolkShape;

    if (callbacks === undefined) {
      this.#elementMap.set(target, (callbacks = new Set()));

      if (isFolkShape) {
        target.addEventListener('transform', this.#onTransform);
        callback({ target, contentRect: target.getTransformDOMRect() });
      } else {
        this.#vo.observe(target);
      }
    } else {
      const contentRect = isFolkShape ? target.getTransformDOMRect() : target.getBoundingClientRect();
      callback({ target, contentRect });
    }

    callbacks.add(callback);
  }

  unobserve(target: Element, callback: ClientRectObserverEntryCallback): void {
    let callbacks = this.#elementMap.get(target);

    if (callbacks === undefined) return;

    callbacks.delete(callback);

    if (callbacks.size === 0) {
      if (target instanceof FolkShape) {
        target.removeEventListener('transform', this.#onTransform);
      } else {
        this.#vo.unobserve(target);
      }
      this.#elementMap.delete(target);
    }
  }
}

export function parseCSSSelector(selector: string): string[] {
  return selector.split('>>>').map((s) => s.trim());
}
