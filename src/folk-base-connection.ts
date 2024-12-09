import { FolkShape } from './folk-shape.ts';
import { parseVertex } from './common/utils.ts';
import { ClientRectObserverEntry } from './common/client-rect-observer.ts';
import { FolkObserver } from './common/folk-observer.ts';

const folkObserver = new FolkObserver();

export class FolkBaseConnection extends HTMLElement {
  static tagName = '';

  static define() {
    if (customElements.get(this.tagName)) return;
    FolkShape.define();
    customElements.define(this.tagName, this);
  }

  #source = '';
  /** A CSS selector for the source of the arrow. */
  get source() {
    return this.#source;
  }

  set source(source) {
    this.#source = source;
    this.observeSource();
  }

  #sourceRect: DOMRectReadOnly | undefined;
  get sourceRect() {
    return this.#sourceRect;
  }

  #sourceElement: Element | null = null;

  get sourceElement() {
    return this.#sourceElement;
  }

  #sourceCallback = (entry: ClientRectObserverEntry) => {
    this.#sourceRect = entry.contentRect;
    this.#update();
  };

  #target = '';
  /** A CSS selector for the target of the arrow. */
  get target() {
    return this.#target;
  }
  set target(target) {
    this.#target = target;
    this.observeTarget();
  }

  #targetRect: DOMRectReadOnly | undefined;
  get targetRect() {
    return this.#targetRect;
  }

  #targetElement: Element | null = null;
  get targetElement() {
    return this.#targetElement;
  }

  #targetCallback = (entry: ClientRectObserverEntry) => {
    this.#targetRect = entry.contentRect;
    this.#update();
  };

  connectedCallback() {
    this.source = this.getAttribute('source') || this.#source;
    this.target = this.getAttribute('target') || this.#target;
  }

  disconnectedCallback() {
    this.unobserveSource();
    this.unobserveTarget();
  }

  observeSource() {
    this.unobserveSource();

    const vertex = parseVertex(this.#source);

    if (vertex) {
      this.#sourceRect = DOMRectReadOnly.fromRect(vertex);
      this.#update();
    } else {
      this.#sourceElement = document.querySelector(this.source);

      if (this.#sourceElement === null) {
        throw new Error('source is not a valid element');
      }

      folkObserver.observe(this.#sourceElement, this.#sourceCallback);
    }
  }

  unobserveSource() {
    if (this.#sourceElement === null) return;

    folkObserver.unobserve(this.#sourceElement, this.#sourceCallback);
  }

  observeTarget() {
    this.unobserveTarget();

    const vertex = parseVertex(this.#target);

    if (vertex) {
      this.#targetRect = DOMRectReadOnly.fromRect(vertex);
      this.#update();
    } else {
      this.#targetElement = document.querySelector(this.#target);

      if (!this.#targetElement) {
        throw new Error('target is not a valid element');
      }

      folkObserver.observe(this.#targetElement, this.#targetCallback);
    }
  }

  unobserveTarget() {
    if (this.#targetElement === null) return;
    folkObserver.unobserve(this.#targetElement, this.#targetCallback);
  }

  #update() {
    if (this.#sourceRect === undefined || this.#targetRect === undefined) return;

    this.render(this.#sourceRect, this.#targetRect);
  }

  // @ts-ignore
  render(sourceRect: DOMRectReadOnly, targetRect: DOMRectReadOnly) {}
}
