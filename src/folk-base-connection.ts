import { parseVertex } from './common/utils.ts';
import { ClientRectObserverEntry } from './common/client-rect-observer.ts';
import { FolkObserver } from './common/folk-observer.ts';
import { FolkElement } from './common/folk-element.ts';
import { property, state } from '@lit/reactive-element/decorators.js';
import { PropertyValues } from '@lit/reactive-element';

const folkObserver = new FolkObserver();

export class FolkBaseConnection extends FolkElement {
  @property({ type: String, reflect: true }) source = '';

  #sourceElement: Element | null = null;

  get sourceElement() {
    return this.#sourceElement;
  }

  @state() sourceRect: DOMRectReadOnly | null = null;

  @property({ type: String, reflect: true }) target = '';

  @state() targetRect: DOMRectReadOnly | null = null;

  #targetElement: Element | null = null;

  get targetElement() {
    return this.#targetElement;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.unobserveSource();
    this.unobserveTarget();
  }

  override update(changedProperties: PropertyValues<this>) {
    super.update(changedProperties);

    if (changedProperties.has('source')) {
      this.observeSource();
    }

    if (changedProperties.has('target')) {
      this.observeTarget();
    }
  }

  #sourceCallback = (entry: ClientRectObserverEntry) => {
    this.sourceRect = entry.contentRect;
  };

  observeSource() {
    this.unobserveSource();

    const vertex = parseVertex(this.source);

    if (vertex) {
      this.sourceRect = DOMRectReadOnly.fromRect(vertex);
    } else {
      this.#sourceElement = document.querySelector(this.source);

      if (this.#sourceElement === null) {
        this.sourceRect = null;
      } else {
        folkObserver.observe(this.#sourceElement, this.#sourceCallback);
      }
    }
  }

  unobserveSource() {
    if (this.#sourceElement === null) return;

    folkObserver.unobserve(this.#sourceElement, this.#sourceCallback);
  }

  #targetCallback = (entry: ClientRectObserverEntry) => {
    this.targetRect = entry.contentRect;
  };

  observeTarget() {
    this.unobserveTarget();

    const vertex = parseVertex(this.target);

    if (vertex) {
      this.targetRect = DOMRectReadOnly.fromRect(vertex);
    } else {
      this.#targetElement = document.querySelector(this.target);

      if (this.#targetElement === null) {
        this.targetRect = null;
      } else {
        folkObserver.observe(this.#targetElement, this.#targetCallback);
      }
    }
  }

  unobserveTarget() {
    if (this.#targetElement === null) return;
    folkObserver.unobserve(this.#targetElement, this.#targetCallback);
  }
}
