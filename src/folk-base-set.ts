import { ClientRectObserverEntry } from './common/client-rect-observer.ts';
import { FolkObserver } from './common/folk-observer.ts';

const folkObserver = new FolkObserver();

const defaultRect = DOMRectReadOnly.fromRect();

export class FolkBaseSet extends HTMLElement {
  static tagName = '';

  static define() {
    if (customElements.get(this.tagName)) return;
    customElements.define(this.tagName, this);
  }

  #sources = this.getAttribute('sources') || '';
  /** A CSS selector for the sources of the arrow. */
  get sources() {
    return this.#sources;
  }

  set sources(sources) {
    this.#sources = sources;
    this.observeSources();
  }

  #sourcesMap = new Map<Element, DOMRectReadOnly>();
  get sourcesMap(): ReadonlyMap<Element, DOMRectReadOnly> {
    return this.#sourcesMap;
  }

  get sourceRects() {
    return Array.from(this.#sourcesMap.values());
  }

  #sourceElements = new Set<Element>();
  get sourceElements(): ReadonlySet<Element> {
    return this.#sourceElements;
  }

  #sourcesCallback = (entry: ClientRectObserverEntry) => {
    this.#sourcesMap.set(entry.target, entry.contentRect);
    if (this.#sourceElements.size === this.#sourcesMap.size) {
      this.update();
    }
  };

  connectedCallback() {
    this.observeSources();
  }

  disconnectedCallback() {
    this.unobserveSources();
  }

  observeSources() {
    const elements = this.sources ? document.querySelectorAll(this.sources) : [];
    const childElements = new Set(this.children);
    const sourceElements = new Set(elements).union(childElements);

    const elementsToObserve = sourceElements.difference(this.#sourceElements);

    const elementsToUnobserve = this.#sourceElements.difference(sourceElements);

    this.unobserveSources(elementsToUnobserve);

    for (const el of elementsToObserve) {
      folkObserver.observe(el, this.#sourcesCallback);
    }

    this.#sourceElements = sourceElements;
  }

  unobserveSources(elements: Set<Element> = this.#sourceElements) {
    for (const el of elements) {
      folkObserver.unobserve(el, this.#sourcesCallback);
      this.#sourcesMap.delete(el);
      this.#sourceElements.delete(el);
    }
  }

  update() {}
}
