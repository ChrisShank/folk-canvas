export type Shape = 'rectangle' | 'circle' | 'triangle';

// Can we make adding new shapes extensible via a static property?
const shapes = new Set(['rectangle', 'circle', 'triangle']);

export type Vector = { x: number; y: number };

// Should the move event bubble?
export class MoveEvent extends CustomEvent<Vector> {
  constructor(vector: Vector) {
    super('move', { detail: vector, bubbles: false });
  }
}

// TODO: add z coordinate?
export class SpatialGeometry extends HTMLElement {
  static tagName = 'spatial-geometry';

  static register() {
    customElements.define(this.tagName, this);
  }

  static observedAttributes = ['type', 'x', 'y'];

  constructor() {
    super();

    this.addEventListener('pointerdown', this);
    this.addEventListener('lostpointercapture', this);
    this.addEventListener('touchstart', this);
    this.addEventListener('dragstart', this);
  }

  #type: Shape = 'rectangle';
  get type(): Shape {
    return this.#type;
  }

  set type(type: Shape) {
    this.setAttribute('type', type);
  }

  #x = 0;
  get x(): number {
    return this.#x;
  }

  set x(x: number) {
    this.setAttribute('x', x.toString());
  }

  #y = 0;
  get y(): number {
    return this.#y;
  }

  set y(y: number) {
    this.setAttribute('y', y.toString());
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === 'x') {
      this.#x = Number(newValue);
      // In the future, when CSS `attr()` is supported we could define this x/y projection in CSS.
      this.style.left = `${this.#x}px`;
      this.#emitMoveEvent();
    } else if (name === 'y') {
      this.#y = Number(newValue);
      this.style.top = `${this.#y}px`;
      this.#emitMoveEvent();
    } else if (name === 'type') {
      if (shapes.has(newValue)) {
        this.#type = newValue as Shape;
        // TODO: Update shape styles. Ideally we could just use clip-path to style the shape.
        // See https://www.smashingmagazine.com/2024/05/modern-guide-making-css-shapes/
      }
    }
  }

  // Similar to `Element.getClientBoundingRect()`, but returns an SVG path that precisely outlines the shape.
  // We might also want some kind of utility function that maps a path into an approximate set of vertices.
  getBoundingPath(): string {
    return '';
  }

  handleEvent(event: PointerEvent) {
    switch (event.type) {
      case 'pointerdown': {
        if (event.button !== 0 || event.ctrlKey) return;

        this.addEventListener('pointermove', this);
        this.setPointerCapture(event.pointerId);
        this.style.userSelect = 'none';
        return;
      }
      case 'pointermove': {
        this.x += event.movementX;
        this.y += event.movementY;
        return;
      }
      case 'lostpointercapture': {
        this.style.userSelect = '';
        this.removeEventListener('pointermove', this);
        return;
      }
      case 'touchstart':
      case 'dragstart': {
        event.preventDefault();
        return;
      }
    }
  }

  #isMoveScheduled = false;

  // Without some form of changes to x and y will cause separate events to be dispatched.
  // Should we only emit a move event every animation frame or with something like `queueMicrotask`?
  #emitMoveEvent() {
    if (this.#isMoveScheduled) return;

    this.#isMoveScheduled = true;
    requestAnimationFrame(() => {
      this.dispatchEvent(new MoveEvent({ x: this.#x, y: this.#y }));
      this.#isMoveScheduled = false;
    });
  }
}
