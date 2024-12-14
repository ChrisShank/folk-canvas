import { property, state } from '@lit/reactive-element/decorators.js';
import { ClientRectObserverEntry } from './common/client-rect-observer.ts';
import { FolkElement } from './common/folk-element.ts';
import { FolkObserver } from './common/folk-observer.ts';
import { css, CSSResultGroup, PropertyValues } from '@lit/reactive-element';

const folkObserver = new FolkObserver();

// TODO: use mutation observer to track the addition an removal of elements
export class FolkBaseSet extends FolkElement {
  static styles: CSSResultGroup = css`
    :host {
      display: block;
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    ::slotted(*) {
      pointer-events: auto;
    }
  `;

  @property({ type: String, reflect: true }) sources = '';

  #sourcesMap = new Map<Element, DOMRectReadOnly>();
  get sourcesMap(): ReadonlyMap<Element, DOMRectReadOnly> {
    return this.#sourcesMap;
  }

  get sourceRects() {
    return Array.from(this.#sourcesMap.values());
  }

  @state() sourceElements = new Set<Element>();

  #slot = document.createElement('slot');

  override createRenderRoot() {
    const root = super.createRenderRoot();

    root.append(this.#slot);

    this.#slot.addEventListener('slotchange', this.#onSlotchange);

    return root;
  }

  override willUpdate(changedProperties: PropertyValues<this>) {
    super.willUpdate(changedProperties);

    if (changedProperties.has('sources')) {
      this.#observeSources();
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.unobserveSources();
  }

  // we might not need to react to the first slot change
  #onSlotchange = () => this.#observeSources();

  #observeSources() {
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

  #sourcesCallback = (entry: ClientRectObserverEntry) => {
    this.#sourcesMap.set(entry.target, entry.contentRect);
    this.requestUpdate();
  };

  unobserveSources(elements: Set<Element> = this.sourceElements) {
    for (const el of elements) {
      folkObserver.unobserve(el, this.#sourcesCallback);
      this.#sourcesMap.delete(el);
      this.sourceElements.delete(el);
    }
  }
}
