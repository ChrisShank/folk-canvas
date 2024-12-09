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
    this.observeSources();
  }

  disconnectedCallback() {
    this.unobserveSources();
  }

  observeSources() {
    const elements = this.sources ? document.querySelectorAll(this.sources) : [];
    const childElements = new Set(this.querySelectorAll('*'));
    const sourceElements = new Set(elements).union(childElements);

    const currentElements = new Set(this.#sourcesMap.keys());

    const elementsToObserve = sourceElements.difference(currentElements);

    const elementsToUnobserve = currentElements.difference(sourceElements);

    this.unobserveSources(elementsToUnobserve);

    for (const el of elementsToObserve) {
      folkObserver.observe(el, this.#sourcesCallback);
    }

    this.update();
  }

  unobserveSources(elements: Iterable<Element> = this.#sourcesMap.keys()) {
    for (const el of elements) {
      folkObserver.unobserve(el, this.#sourcesCallback);
      this.#sourcesMap.delete(el);
    }
  }

  update() {}
}
