import { property, state } from '@lit/reactive-element/decorators.js';
import { ClientRectObserverEntry } from './common/client-rect-observer.ts';
import { FolkElement } from './common/folk-element.ts';
import { FolkObserver } from './common/folk-observer.ts';
import { PropertyValues } from '@lit/reactive-element';

const folkObserver = new FolkObserver();

export class FolkBaseSet extends FolkElement {
  @property({ type: String, reflect: true }) sources = '';

  #sourcesMap = new Map<Element, DOMRectReadOnly>();
  get sourcesMap(): ReadonlyMap<Element, DOMRectReadOnly> {
    return this.#sourcesMap;
  }

  get sourceRects() {
    return Array.from(this.#sourcesMap.values());
  }

  @state() sourceElements = new Set<Element>();

  #sourcesCallback = (entry: ClientRectObserverEntry) => {
    this.#sourcesMap.set(entry.target, entry.contentRect);
    this.requestUpdate();
  };

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unobserveSources();
  }

  override update(changedProperties: PropertyValues<this>) {
    super.update(changedProperties);

    if (changedProperties.has('sources')) {
      this.observeSources();
    }
  }

  observeSources() {
    const childElements = new Set(this.children);
    const elements = this.sources ? document.querySelectorAll(this.sources) : [];
    const sourceElements = new Set(elements).union(childElements);
    const elementsToObserve = sourceElements.difference(this.sourceElements);
    const elementsToUnobserve = this.sourceElements.difference(sourceElements);

    this.unobserveSources(elementsToUnobserve);

    for (const el of elementsToObserve) {
      folkObserver.observe(el, this.#sourcesCallback);
    }

    this.sourceElements = sourceElements;
  }

  unobserveSources(elements: Set<Element> = this.sourceElements) {
    for (const el of elements) {
      folkObserver.unobserve(el, this.#sourcesCallback);
      this.#sourcesMap.delete(el);
      this.sourceElements.delete(el);
    }
  }
}
