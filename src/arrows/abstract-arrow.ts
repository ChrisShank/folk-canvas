import { VisualObserverEntry, VisualObserverManager } from './visual-observer';

const visualObserver = new VisualObserverManager();

interface Vertex {
  x: number;
  y: number;
}

const vertexRegex = /(?<x>-?([0-9]*[.])?[0-9]+),\s*(?<y>-?([0-9]*[.])?[0-9]+)/;

function parseVertex(str: string): Vertex | null {
  const results = vertexRegex.exec(str);

  if (results === null) return null;

  return {
    x: Number(results.groups?.x),
    y: Number(results.groups?.y),
  };
}

export class AbstractArrow extends HTMLElement {
  static tagName = 'abstract-arrow';

  static register() {
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

  #sourceRect!: DOMRectReadOnly;
  get sourceRect() {
    return this.#sourceRect;
  }

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
    this.#target = target;
    this.observeTarget();
  }

  #targetRect!: DOMRectReadOnly;
  get targetRect() {
    return this.#targetRect;
  }

  #targetElement: Element | null = null;
  get targetElement() {
    return this.#targetElement;
  }

  #targetCallback = (entry: VisualObserverEntry) => {
    this.#targetRect = entry.contentRect;
    this.update();
  };

  connectedCallback() {
    this.source = this.getAttribute('source') || '';
    this.target = this.getAttribute('target') || '';
  }

  disconnectedCallback() {
    this.unobserveSource();
    this.unobserveTarget();
  }

  // TODO: why reparse the vertex?
  setSourceVertex(vertex: Vertex) {
    this.target = `${vertex.x},${vertex.y}`;
  }

  observeSource() {
    this.unobserveSource();

    const vertex = parseVertex(this.#source);

    if (vertex) {
      this.#sourceRect = DOMRectReadOnly.fromRect(vertex);
      this.update();
    } else {
      const el = document.querySelector(this.source);

      if (el === null) {
        throw new Error('source is not a valid element');
      }

      this.#sourceElement = el;
      visualObserver.observe(this.#sourceElement, this.#sourceCallback);
    }
  }

  unobserveSource() {
    if (this.#sourceElement === null) return;

    visualObserver.unobserve(this.#sourceElement, this.#sourceCallback);
  }

  observeTarget() {
    this.unobserveTarget();

    const vertex = parseVertex(this.#target);

    if (vertex) {
      this.#targetRect = DOMRectReadOnly.fromRect(vertex);
      this.update();
    } else {
      this.#targetElement = document.querySelector(this.#target);

      if (!this.#targetElement) {
        throw new Error('target is not a valid element');
      }

      visualObserver.observe(this.#targetElement, this.#targetCallback);
    }
  }

  unobserveTarget() {
    if (this.#targetElement === null) return;

    visualObserver.unobserve(this.#targetElement, this.#targetCallback);
  }

  update() {
    if (this.#sourceRect === undefined || this.#targetRect === undefined) return;

    this.render();
  }

  render() {}
}
