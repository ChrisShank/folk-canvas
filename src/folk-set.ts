import { ClientRectObserverEntry, ClientRectObserverManager } from './client-rect-observer.ts';

const clientRectObserver = new ClientRectObserverManager();

declare global {
  interface HTMLElementTagNameMap {
    'folk-set': FolkSet;
  }
}

export class FolkSet extends HTMLElement {
  static tagName = 'folk-set';

  static register() {
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
  get sourcesMap() {
    return this.#sourcesMap;
  }

  get sourceElements() {
    return Array.from(this.#sourcesMap.keys());
  }

  #sourcesCallback = (entry: ClientRectObserverEntry) => {
    this.#sourcesMap.set(entry.target, entry.contentRect);
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
