export type Shape = 'rectangle' | 'circle' | 'triangle';

export type MoveEventDetail = { movementX: number; movementY: number };

export class MoveEvent extends CustomEvent<MoveEventDetail> {
  constructor(detail: MoveEventDetail) {
    super('move', { detail, cancelable: true, bubbles: true });
  }
}

export type ResizeEventDetail = { movementX: number; movementY: number };

export class ResizeEvent extends CustomEvent<MoveEventDetail> {
  constructor(detail: MoveEventDetail) {
    super('resize', { detail, cancelable: true, bubbles: true });
  }
}

export type RotateEventDetail = { rotate: number };

export class RotateEvent extends CustomEvent<RotateEventDetail> {
  constructor(detail: RotateEventDetail) {
    super('rotate', { detail, cancelable: true, bubbles: true });
  }
}

const styles = new CSSStyleSheet();
styles.replaceSync(`
:host {
  display: block;
  position: absolute;
  padding: 20px 10px 10px;
  cursor: var(--fc-move, move);
  content-visibility: auto;
}

::slotted(*) {
  cursor: default;
}

:host > div {
  position: relative;
  width: 100%;
  height: 100%;
}

:host > div > div {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

:host(:focus-within) > div {
  outline: solid 1px hsl(214, 84%, 56%);
}

:host(:hover) > div {
  outline: solid 2px hsl(214, 84%, 56%);
}

:host(:state(moving)) {
  user-select: none;
}

:host(:not(:focus-within)) [part^="resize"], :host(:not(:focus-within)) [part="rotate"] {
  opacity: 0;
}

[part^="resize"] {
  display: block;
  position: absolute;
  box-sizing: border-box;
  padding: 0;
  background: hsl(210, 20%, 98%);
  z-index: calc(infinity);

  &[part="resize-nw"], 
  &[part="resize-ne"], 
  &[part="resize-se"], 
  &[part="resize-sw"] {
    width: 13px;
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
    border: 1.5px solid hsl(214, 84%, 56%);
    border-radius: 2px;
  }

  &[part="resize-nw"] {
    top: 0;
    left: 0;
  }
  
  &[part="resize-ne"] {
    top: 0;
    left: 100%;
  }
  
  &[part="resize-se"] {
    top: 100%;
    left: 100%;
  }
    
  &[part="resize-sw"] {
    top: 100%;
    left: 0;
  }

  &[part="resize-nw"], &[part="resize-se"] {
    cursor: var(--fc-nwse-resize, nwse-resize)
  }
    
  &[part="resize-ne"], &[part="resize-sw"] {
    cursor: var(--fc-nesw-resize, nesw-resize)
  }
}

[part="rotate"] {
  z-index: calc(infinity);
  display: block;
  position: absolute;
  box-sizing: border-box;
  padding: 0;
  border: 1.5px solid hsl(214, 84%, 56%);
  border-radius: 50%;
  background: hsl(210, 20%, 98%);
  width: 13px;
  aspect-ratio: 1;
  top: 0;
  left: 50%;
  translate: -50% -150%;
  cursor: url("data:image/svg+xml,<svg height='32' width='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg' style='color: black;'><defs><filter id='shadow' y='-40%' x='-40%' width='180px' height='180%' color-interpolation-filters='sRGB'><feDropShadow dx='1' dy='1' stdDeviation='1.2' flood-opacity='.5'/></filter></defs><g fill='none' transform='rotate(45 16 16)' filter='url(%23shadow)'><path d='M22.4789 9.45728L25.9935 12.9942L22.4789 16.5283V14.1032C18.126 14.1502 14.6071 17.6737 14.5675 22.0283H17.05L13.513 25.543L9.97889 22.0283H12.5674C12.6071 16.5691 17.0214 12.1503 22.4789 12.1031L22.4789 9.45728Z' fill='black'/><path fill-rule='evenodd' clip-rule='evenodd' d='M21.4789 7.03223L27.4035 12.9945L21.4789 18.9521V15.1868C18.4798 15.6549 16.1113 18.0273 15.649 21.0284H19.475L13.5128 26.953L7.55519 21.0284H11.6189C12.1243 15.8155 16.2679 11.6677 21.4789 11.1559L21.4789 7.03223ZM22.4789 12.1031C17.0214 12.1503 12.6071 16.5691 12.5674 22.0284H9.97889L13.513 25.543L17.05 22.0284H14.5675C14.5705 21.6896 14.5947 21.3558 14.6386 21.0284C15.1157 17.4741 17.9266 14.6592 21.4789 14.1761C21.8063 14.1316 22.1401 14.1069 22.4789 14.1032V16.5284L25.9935 12.9942L22.4789 9.45729L22.4789 12.1031Z' fill='white'/></g></svg>") 16 16, pointer;
}`);

// TODO: add z coordinate?
export class SpatialGeometry extends HTMLElement {
  static tagName = 'spatial-geometry';

  static register() {
    customElements.define(this.tagName, this);
  }

  #internals = this.attachInternals();

  constructor() {
    super();

    this.addEventListener('pointerdown', this);
    this.addEventListener('lostpointercapture', this);
    // this.addEventListener('touchstart', this);
    // this.addEventListener('dragstart', this);

    const shadowRoot = this.attachShadow({ mode: 'open', delegatesFocus: true });
    shadowRoot.adoptedStyleSheets.push(styles);
    // Ideally we would creating these lazily on first focus, but the resize handlers need to be around for delegate focus to work.
    // Maybe can add the first resize handler here, and lazily instantiate the rest when needed?
    // I can see it becoming important at scale
    shadowRoot.innerHTML = `
<div>
  <button part="rotate"></button>
  <button part="resize-nw"></button>
  <button part="resize-ne"></button>
  <button part="resize-se"></button>
  <button part="resize-sw"></button>
  <div><slot></slot></div>
</div>`;
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
    this.#x = x;
    this.#requestUpdate('x');
  }

  #previousY = 0;
  #y = 0;
  get y(): number {
    return this.#y;
  }

  set y(y: number) {
    this.#y = y;
    this.#requestUpdate('y');
  }

  #previousWidth = 0;
  #width = 1;
  get width(): number {
    return this.#width;
  }

  set width(width: number) {
    this.#width = width;
    this.#requestUpdate('width');
  }

  #previousHeight = 0;
  #height = 1;
  get height(): number {
    return this.#height;
  }

  set height(height: number) {
    this.#height = height;
    this.#requestUpdate('height');
  }

  #previousRotate = 0;
  #rotate = 0;
  get rotate(): number {
    return this.#rotate;
  }

  set rotate(rotate: number) {
    this.#rotate = rotate;
    this.#requestUpdate('rotate');
  }

  connectedCallback() {
    this.type = (this.getAttribute('type') || 'rectangle') as Shape;
    this.x = Number(this.getAttribute('x')) || 0;
    this.y = Number(this.getAttribute('y')) || 0;
    this.height = Number(this.getAttribute('height')) || 0;
    this.width = Number(this.getAttribute('width')) || 0;
    this.rotate = Number(this.getAttribute('rotate')) || 0;
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

        // ignore interactions from slotted elements.
        if (target !== this && !target.hasAttribute('part')) return;

        target.addEventListener('pointermove', this);
        target.setPointerCapture(event.pointerId);
        this.#internals.states.add('moving');
        this.focus();
        return;
      }
      case 'pointermove': {
        const target = event.target as HTMLElement;

        if (target === null) return;

        if (target === this) {
          this.x += event.movementX;
          this.y += event.movementY;
          return;
        }

        const part = target.getAttribute('part');

        if (part === null) return;

        if (part.includes('resize')) {
          // This triggers a move and resize event :(
          if (part.includes('-n')) {
            this.y += event.movementY;
            this.height -= event.movementY;
          }

          if (part.endsWith('e')) {
            this.width += event.movementX;
          }

          if (part.includes('-s')) {
            this.height += event.movementY;
          }

          if (part.endsWith('w')) {
            this.x += event.movementX;
            this.width -= event.movementX;
          }
          return;
        }

        if (part === 'rotate') {
          const centerX = (this.#x + this.#width) / 2;
          const centerY = (this.#y + this.#height) / 2;
          var newAngle =
            ((Math.atan2(event.clientY - centerY, event.clientX - centerX) + Math.PI / 2) * 180) /
            Math.PI;
          this.rotate = newAngle;
          return;
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
        this.#x = this.#previousX;
        this.#y = this.#previousY;
      }
    }

    if (updatedProperties.has('width') || updatedProperties.has('height')) {
      // Although the change in resize isn't useful inside this component, the outside world might find it helpful to calculate acceleration and other physics
      const notCancelled = this.dispatchEvent(
        new ResizeEvent({
          movementX: this.#width - this.#previousWidth,
          movementY: this.#height - this.#previousHeight,
        })
      );

      if (notCancelled) {
        if (updatedProperties.has('width')) {
          this.style.width = `${this.#width}px`;
        }

        if (updatedProperties.has('height')) {
          this.style.height = `${this.#height}px`;
        }
      } else {
        // TODO: Revert changes to position too
        this.#height = this.#previousHeight;
        this.#width = this.#previousWidth;
      }
    }

    if (updatedProperties.has('rotate')) {
      // Although the change in resize isn't useful inside this component, the outside world might find it helpful to calculate acceleration and other physics
      const notCancelled = this.dispatchEvent(
        new RotateEvent({ rotate: this.#rotate - this.#previousRotate })
      );

      if (notCancelled) {
        if (updatedProperties.has('rotate')) {
          this.style.rotate = `${this.#rotate}deg`;
        }
      } else {
        this.#rotate = this.#previousRotate;
      }
    }
  }
}
