export type Shape = 'rectangle' | 'circle' | 'triangle';

// Can we make adding new shapes extensible via a static property?
const shapes = new Set(['rectangle', 'circle', 'triangle']);

export type MoveEventDetail = { x: number; y: number; movementX: number; movementY: number };

// Should the move event bubble?
export class MoveEvent extends CustomEvent<MoveEventDetail> {
  constructor(vector: MoveEventDetail) {
    super('move', { detail: vector, cancelable: true, bubbles: true });
  }
}

const styles = new CSSStyleSheet();
styles.replaceSync(`
:host {
  display: block;
  position: absolute;
  cursor: pointer;
}

:host(:state(moving)) {
  cursor: url("data:image/svg+xml,<svg height='32' width='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg' style='color: black;'><defs><filter id='shadow' y='-40%' x='-40%' width='180px' height='180%' color-interpolation-filters='sRGB'><feDropShadow dx='1' dy='1' stdDeviation='1.2' flood-opacity='.5'/></filter></defs><g fill='none' transform='rotate(0 16 16)' filter='url(%23shadow)'><path d='m19 14h1v1h-1zm1 6h-1v-1h1zm-5-5h-1v-1h1zm0 5h-1v-1h1zm2-10.987-7.985 7.988 5.222 5.221 2.763 2.763 7.984-7.985z' fill='white'/><g fill='black'><path d='m23.5664 16.9971-2.557-2.809v1.829h-4.009-4.001v-1.829l-2.571 2.809 2.572 2.808-.001-1.808h4.001 4.009l-.001 1.808z'/><path d='m17.9873 17h.013v-4.001l1.807.001-2.807-2.571-2.809 2.57h1.809v4.001h.008v4.002l-1.828-.001 2.807 2.577 2.805-2.576h-1.805z'/></g></g></svg>") 16 16, pointer;
  user-select: none;
}

:host(:not(:focus, :focus-within, :state(moving))) [resize-handler] {
  opacity: 0;
}

:is(:host(:focus), :host(:focus-within), :host(:state(moving))) [resize-handler] {
  display: block;
  position: absolute;
  box-sizing: border-box;
  padding: 0;
  background: hsl(210, 20%, 98%);

  &[resize-handler="top-left"], 
  &[resize-handler="top-right"], 
  &[resize-handler="bottom-right"], 
  &[resize-handler="bottom-left"] {
    width: 13px;
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
    border: 1.5px solid hsl(214, 84%, 56%);
    border-radius: 2px;
    z-index: 2;
  }

  &[resize-handler="top-left"] {
    top: 0;
    left: 0;
  }
  
  &[resize-handler="top-right"] {
    top: 0;
    left: 100%;
  }
  
  &[resize-handler="bottom-right"] {
    top: 100%;
    left: 100%;
  }
    
  &[resize-handler="bottom-left"] {
    top: 100%;
    left: 0;
  }

  &[resize-handler="top-left"], &[resize-handler="bottom-right"] {
    cursor: url("data:image/svg+xml,<svg height='32' width='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg' style='color: black;'><defs><filter id='shadow' y='-40%' x='-40%' width='180px' height='180%' color-interpolation-filters='sRGB'><feDropShadow dx='1' dy='-0.9999999999999999' stdDeviation='1.2' flood-opacity='.5'/></filter></defs><g fill='none' transform='rotate(90 16 16)' filter='url(%23shadow)'><path d='m19.7432 17.0869-4.072 4.068 2.829 2.828-8.473-.013-.013-8.47 2.841 2.842 4.075-4.068 1.414-1.415-2.844-2.842h8.486v8.484l-2.83-2.827z' fill='%23fff'/><path d='m18.6826 16.7334-4.427 4.424 1.828 1.828-5.056-.016-.014-5.054 1.842 1.841 4.428-4.422 2.474-2.475-1.844-1.843h5.073v5.071l-1.83-1.828z' fill='%23000'/></g></svg>") 16 16, pointer;
  }

  &[resize-handler="top-right"], &[resize-handler="bottom-left"] {
    cursor: url("data:image/svg+xml,<svg height='32' width='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg' style='color: black;'><defs><filter id='shadow' y='-40%' x='-40%' width='180px' height='180%' color-interpolation-filters='sRGB'><feDropShadow dx='1' dy='1' stdDeviation='1.2' flood-opacity='.5'/></filter></defs><g fill='none' transform='rotate(0 16 16)' filter='url(%23shadow)'><path d='m19.7432 17.0869-4.072 4.068 2.829 2.828-8.473-.013-.013-8.47 2.841 2.842 4.075-4.068 1.414-1.415-2.844-2.842h8.486v8.484l-2.83-2.827z' fill='%23fff'/><path d='m18.6826 16.7334-4.427 4.424 1.828 1.828-5.056-.016-.014-5.054 1.842 1.841 4.428-4.422 2.474-2.475-1.844-1.843h5.073v5.071l-1.83-1.828z' fill='%23000'/></g></svg>") 16 16, pointer;
  }

  &[resize-handler="top"], 
  &[resize-handler="right"], 
  &[resize-handler="bottom"], 
  &[resize-handler="left"] {
    background-color: hsl(214, 84%, 56%);
    background-clip: content-box;
    border: unset;
    z-index: 1;
  }

  &[resize-handler="top"] {
    top: 0;
    left: 0;
    right: 0;
    transform: translate(0, -50%);
  }
  
  &[resize-handler="right"] {
    top: 0;
    bottom: 0;
    right: 0;
    transform: translate(50%, 0);
  }
  
  &[resize-handler="bottom"] {
    bottom:0;
    left: 0;
    right: 0;
    transform: translate(0, 50%);
  }
    
  &[resize-handler="left"] {
    top: 0;
    bottom: 0;
    left: 0;
    transform: translate(-50%, 0);
  }

  &[resize-handler="top"], &[resize-handler="bottom"] {
    height: 6px;
    padding: 2px 0;
    cursor: url("data:image/svg+xml,<svg height='32' width='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg' style='color: black;'><defs><filter id='shadow' y='-40%' x='-40%' width='180px' height='180%' color-interpolation-filters='sRGB'><feDropShadow dx='1' dy='-0.9999999999999999' stdDeviation='1.2' flood-opacity='.5'/></filter></defs><g fill='none' transform='rotate(90 16 16)' filter='url(%23shadow)'><path d='m9 17.9907v.005l5.997 5.996.001-3.999h1.999 2.02v4l5.98-6.001-5.98-5.999.001 4.019-2.021.002h-2l.001-4.022zm1.411.003 3.587-3.588-.001 2.587h3.5 2.521v-2.585l3.565 3.586-3.564 3.585-.001-2.585h-2.521l-3.499-.001-.001 2.586z' fill='%23fff'/><path d='m17.4971 18.9932h2.521v2.586l3.565-3.586-3.565-3.585v2.605h-2.521-3.5v-2.607l-3.586 3.587 3.586 3.586v-2.587z' fill='%23000'/></g></svg>") 16 16, pointer;
  }

  &[resize-handler="right"], &[resize-handler="left"] {
    width: 6px;
    padding: 0 2px;
    cursor: url("data:image/svg+xml,<svg height='32' width='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg' style='color: black;'><defs><filter id='shadow' y='-40%' x='-40%' width='180px' height='180%' color-interpolation-filters='sRGB'><feDropShadow dx='1' dy='1' stdDeviation='1.2' flood-opacity='.5'/></filter></defs><g fill='none' transform='rotate(0 16 16)' filter='url(%23shadow)'><path d='m9 17.9907v.005l5.997 5.996.001-3.999h1.999 2.02v4l5.98-6.001-5.98-5.999.001 4.019-2.021.002h-2l.001-4.022zm1.411.003 3.587-3.588-.001 2.587h3.5 2.521v-2.585l3.565 3.586-3.564 3.585-.001-2.585h-2.521l-3.499-.001-.001 2.586z' fill='%23fff'/><path d='m17.4971 18.9932h2.521v2.586l3.565-3.586-3.565-3.585v2.605h-2.521-3.5v-2.607l-3.586 3.587 3.586 3.586v-2.587z' fill='%23000'/></g></svg>") 16 16, pointer;
  }
}`);

// TODO: add z coordinate?
export class SpatialGeometry extends HTMLElement {
  static tagName = 'spatial-geometry';

  static register() {
    customElements.define(this.tagName, this);
  }

  static observedAttributes = ['type', 'x', 'y'];

  #internals: ElementInternals;

  constructor() {
    super();
    this.#internals = this.attachInternals();
    this.addEventListener('pointerdown', this);
    this.addEventListener('lostpointercapture', this);
    this.addEventListener('touchstart', this);
    this.addEventListener('dragstart', this);

    const shadowRoot = this.attachShadow({ mode: 'open', delegatesFocus: true });
    shadowRoot.adoptedStyleSheets.push(styles);
    // Ideally we would creating these lazily on first focus, but the resize handlers need to be around for delegate focus to work.
    shadowRoot.innerHTML = `
<button resize-handler="top-left"></button>
<button resize-handler="top"></button>
<button resize-handler="top-right"></button>
<button resize-handler="right"></button>
<button resize-handler="bottom-right"></button>
<button resize-handler="bottom"></button>
<button resize-handler="bottom-left"></button>
<button resize-handler="left"></button>`;
  }

  #type: Shape = 'rectangle';
  get type(): Shape {
    return this.#type;
  }

  set type(type: Shape) {
    this.setAttribute('type', type);
  }

  #previousX = 0;
  #x = 0;
  get x(): number {
    return this.#x;
  }

  set x(x: number) {
    this.setAttribute('x', x.toString());
  }

  #previousY = 0;
  #y = 0;
  get y(): number {
    return this.#y;
  }

  set y(y: number) {
    this.setAttribute('y', y.toString());
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === 'x') {
      this.#previousX = this.#x;
      this.#x = Number(newValue);
      this.#requestUpdate('x');
    } else if (name === 'y') {
      this.#previousY = this.#y;
      this.#y = Number(newValue);
      this.#requestUpdate('y');
    } else if (name === 'type') {
      if (shapes.has(newValue)) {
        this.#type = newValue as Shape;
        this.#requestUpdate('type');
      }
    }
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.#rAFId);
  }

  // Similar to `Element.getClientBoundingRect()`, but returns an SVG path that precisely outlines the shape.
  getBoundingPath(): string {
    return '';
  }

  // We might also want some kind of utility function that maps a path into an approximate set of vertices.
  getBoundingVertices() {
    return [];
  }

  handleEvent(event: PointerEvent) {
    switch (event.type) {
      case 'pointerdown': {
        if (event.button !== 0 || event.ctrlKey) return;

        const target = event.composedPath()[0] as HTMLElement;

        target.addEventListener('pointermove', this);
        target.setPointerCapture(event.pointerId);
        this.#internals.states.add('moving');
        this.focus();
        return;
      }
      case 'pointermove': {
        if (event.target === this) {
          this.x += event.movementX;
          this.y += event.movementY;
        } else if ((event.target as HTMLElement).matches('[resize-handler]')) {
          console.log('resizing');
        }
        return;
      }
      case 'lostpointercapture': {
        this.#internals.states.delete('moving');
        const target = event.composedPath()[0] as HTMLElement;
        target.removeEventListener('pointermove', this);
        return;
      }
      case 'touchstart':
      case 'dragstart': {
        event.preventDefault();
        return;
      }
    }
  }

  #updatedProperties = new Set<string>();
  #rAFId = -1;
  #isUpdating = false;

  #requestUpdate(property: string) {
    this.#updatedProperties.add(property);

    if (this.#isUpdating) return;

    this.#isUpdating = true;
    this.#rAFId = requestAnimationFrame(() => {
      this.#isUpdating = false;
      this.#update(this.#updatedProperties);
      this.#updatedProperties.clear();
      this.#rAFId = -1;
    });
  }

  // Any updates that should be batched should happen here like updating the DOM or emitting events should be executed here.
  #update(updatedProperties: Set<string>) {
    if (updatedProperties.has('type')) {
      // TODO: Update shape styles. For many shapes, we could just use clip-path to style the shape.
      // If we use relative values in `clip-path: polygon()`, then no JS is needed to style the shape
      // If `clip-path: path()` is used then we need to update the path in JS.
      // See https://www.smashingmagazine.com/2024/05/modern-guide-making-css-shapes/
    }

    if (updatedProperties.has('x') || updatedProperties.has('y')) {
      // Although the change in movement isn't useful inside this component, the outside world might find it helpful to calculate acceleration and other physics
      const notCancelled = this.dispatchEvent(
        new MoveEvent({
          x: this.#x,
          y: this.#y,
          movementX: this.#x - this.#previousX,
          movementY: this.#y - this.#previousY,
        })
      );

      if (notCancelled) {
        if (updatedProperties.has('x')) {
          // In the future, when CSS `attr()` is supported we could define this x/y projection in CSS.
          this.style.left = `${this.#x}px`;
        }

        if (updatedProperties.has('y')) {
          this.style.top = `${this.#y}px`;
        }
      } else {
        // Revert changes to movement
        this.#x = this.#previousX;
        this.#y = this.#previousY;
      }
    }
  }
}
