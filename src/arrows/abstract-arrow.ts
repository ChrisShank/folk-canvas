import { VisualObserverEntry, VisualObserverManager } from './visual-observer';

const visualObserver = new VisualObserverManager();

export class AbstractArrow extends HTMLElement {
  static tagName = 'abstract-arrow';

  static register() {
    customElements.define(this.tagName, this);
  }

  static observedAttributes = ['source', 'target'];

  #source = '';
  /** A CSS selector for the source of the arrow. */
  get source() {
    return this.#source;
  }

  set source(source) {
    this.setAttribute('source', source);
  }

  #sourceRect!: DOMRectReadOnly;
  #sourceElement: Element | null = null;

  get sourceElement() {
    return this.#sourceElement;
  }

  #sourceCallback = (entry: VisualObserverEntry) => {
    this.#sourceRect = entry.contentRect;
    this.update();
  };

  #target = '';
  /** A CSS selector for the target of the arrow. */
  get target() {
    return this.#target;
  }

  set target(target) {
    this.setAttribute('target', target);
  }

  #targetRect!: DOMRectReadOnly;
  #targetElement: Element | null = null;

  get targetElement() {
    return this.#targetElement;
  }

  #targetCallback = (entry: VisualObserverEntry) => {
    this.#targetRect = entry.contentRect;
    this.update();
  };

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === 'source') {
      this.#source = newValue;
      this.observeSource();
    } else if (name === 'target') {
      this.#target = newValue;
      this.observeTarget();
    }
  }

  disconnectedCallback() {
    this.unobserveSource();
    this.unobserveTarget();
  }

  observeSource() {
    this.unobserveSource();
    const el = document.querySelector(this.source);

    if (el === null) {
      throw new Error('source is not a valid element');
    }

    this.#sourceElement = el;
    visualObserver.observe(this.#sourceElement, this.#sourceCallback);
  }

  unobserveSource() {
    if (this.#sourceElement === null) return;

    visualObserver.unobserve(this.#sourceElement, this.#sourceCallback);
  }

  observeTarget() {
    this.unobserveTarget();
    this.#targetElement = document.querySelector(this.target);

    if (!this.#targetElement) {
      throw new Error('target is not a valid element');
    }

    visualObserver.observe(this.#targetElement, this.#targetCallback);
  }

  unobserveTarget() {
    if (this.#targetElement === null) return;

    visualObserver.unobserve(this.#targetElement, this.#targetCallback);
  }

  update() {
    if (
      this.#sourceRect === undefined ||
      this.#targetRect === undefined ||
      this.#sourceElement === null ||
      this.#targetElement === null
    )
      return;

    this.render(this.#sourceRect, this.#targetRect, this.#sourceElement, this.#targetElement);
  }

  render(
    // @ts-ignore
    sourceRect: DOMRectReadOnly,
    // @ts-ignore
    targetRect: DOMRectReadOnly,
    // @ts-ignore
    sourceElement: Element,
    // @ts-ignore
    targetElement: Element
  ) {}
}
