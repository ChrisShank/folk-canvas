import { ClientRectObserverEntry, ClientRectObserverManager } from './common/client-rect-observer.ts';
import type { RotatedDOMRect } from './common/types';
import { FolkShape } from './folk-shape';

const clientRectObserver = new ClientRectObserverManager();

declare global {
  interface HTMLElementTagNameMap {
    'folk-base-set': FolkBaseSet;
  }
}

const defaultRect = DOMRectReadOnly.fromRect();

export class FolkBaseSet extends HTMLElement {
  static tagName = 'folk-base-set';

  static define() {
    if (customElements.get(this.tagName)) return;
    customElements.define(this.tagName, this);
  }

  #sources = '';
  /** A CSS selector for the sources of the arrow. */
  get sources() {
    return this.#sources;
  }

  set sources(sources) {
    this.#sources = sources;
    this.observeSources();
  }

  #sourcesMap = new Map<Element, DOMRectReadOnly>();
  #sourcesMapRotated = new Map<Element, RotatedDOMRect>();
  get sourcesMap() {
    return this.#sourcesMap;
  }

  get sourcesMapRotated() {
    return this.#sourcesMapRotated;
  }

  get sourceElements() {
    return Array.from(this.#sourcesMap.keys());
  }

  #sourcesCallback = (entry: ClientRectObserverEntry) => {
    this.#sourcesMap.set(entry.target, entry.contentRect);
    if (entry.target instanceof FolkShape) {
      this.#sourcesMapRotated.set(entry.target, entry.target.getClientRect());
    }
    this.update();
  };

  connectedCallback() {
    this.sources = this.getAttribute('sources') || this.#sources;
  }

  disconnectedCallback() {
    this.unobserveSources();
  }

  observeSources() {
    const sourceElements = new Set(document.querySelectorAll(this.sources));

    const currentElements = new Set(this.#sourcesMap.keys());

    const elementsToObserve = sourceElements.difference(currentElements);

    const elementsToUnobserve = currentElements.difference(sourceElements);

    this.unobserveSources(elementsToUnobserve);

    for (const el of elementsToObserve) {
      this.#sourcesMap.set(el, defaultRect);
      clientRectObserver.observe(el, this.#sourcesCallback);
    }

    this.update();
  }

  unobserveSources(elements: Iterable<Element> = this.#sourcesMap.keys()) {
    for (const el of elements) {
      clientRectObserver.unobserve(el, this.#sourcesCallback);
      this.#sourcesMap.delete(el);
    }
  }

  update() {}
}
