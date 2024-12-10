import { parseVertex } from './common/utils.ts';
import { ClientRectObserverEntry } from './common/client-rect-observer.ts';
import { FolkObserver } from './common/folk-observer.ts';
import { FolkElement } from './common/folk-element.ts';
import { property, state } from '@lit/reactive-element/decorators.js';
import { PropertyValues } from '@lit/reactive-element';

const folkObserver = new FolkObserver();

export class FolkBaseConnection extends FolkElement {
  @property({ type: String, reflect: true }) source = '';

  @state() sourceElement: Element | null = null;

  @state() sourceRect: DOMRectReadOnly | null = null;

  @property({ type: String, reflect: true }) target = '';

  @state() targetRect: DOMRectReadOnly | null = null;

  @state() targetElement: Element | null = null;

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#unobserveSource();
    this.#unobserveTarget();
  }

  override willUpdate(changedProperties: PropertyValues<this>) {
    super.willUpdate(changedProperties);

    if (changedProperties.has('source')) {
      this.#unobserveSource();

      const vertex = parseVertex(this.source);

      if (vertex) {
        this.sourceRect = DOMRectReadOnly.fromRect(vertex);
      } else {
        this.sourceElement = document.querySelector(this.source);

        if (this.sourceElement === null) {
          this.sourceRect = null;
        } else {
          folkObserver.observe(this.sourceElement, this.#sourceCallback);
        }
      }
    }

    if (changedProperties.has('target')) {
      this.#unobserveTarget();

      const vertex = parseVertex(this.target);

      if (vertex) {
        this.targetRect = DOMRectReadOnly.fromRect(vertex);
      } else {
        this.targetElement = document.querySelector(this.target);

        if (this.targetElement === null) {
          this.targetRect = null;
        } else {
          folkObserver.observe(this.targetElement, this.#targetCallback);
        }
      }
    }
  }

  #sourceCallback = (entry: ClientRectObserverEntry) => {
    this.sourceRect = entry.contentRect;
  };

  #unobserveSource() {
    if (this.sourceElement === null) return;

    folkObserver.unobserve(this.sourceElement, this.#sourceCallback);
  }

  #targetCallback = (entry: ClientRectObserverEntry) => {
    this.targetRect = entry.contentRect;
  };

  #unobserveTarget() {
    if (this.targetElement === null) return;
    folkObserver.unobserve(this.targetElement, this.#targetCallback);
  }
}
