import { parseVertex } from './common/utils.ts';
import { ClientRectObserverEntry } from './common/client-rect-observer.ts';
import { FolkObserver } from './common/folk-observer.ts';
import { FolkElement } from './common/folk-element.ts';
import { property, state } from '@lit/reactive-element/decorators.js';
import { css, CSSResultGroup, PropertyValues } from '@lit/reactive-element';

const folkObserver = new FolkObserver();

export class FolkBaseConnection extends FolkElement {
  static styles: CSSResultGroup = css`
    :host {
      display: block;
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
  `;

  @property({ type: String, reflect: true }) source?: string;

  @state() sourceElement: Element | null = null;

  @state() sourceRect: DOMRectReadOnly | null = null;

  @property({ type: String, reflect: true }) target?: string;

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

      if (!this.source) return;

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

      if (!this.target) return;

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
