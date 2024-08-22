export type Shape = 'rectangle' | 'circle' | 'triangle';

// Can we make adding new shapes extensible via a static property?
const shapes = new Set(['rectangle', 'circle', 'triangle']);

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
  cursor: var(--fc-grab, grab);
  content-visibility: auto;
}

:host > div {
  position: relative;
  width: 100%;
  height: 100%;
}

:host(:focus-within) > div {
  outline: solid 1px hsl(214, 84%, 56%);
}

:host(:hover) > div {
  outline: solid 2px hsl(214, 84%, 56%);
}

:host(:state(moving)) {
  cursor: var(--fc-grabbing, grabbing);
  user-select: none;
}

:host(:not(:focus-within)) [resize-handler], :host(:not(:focus-within)) [rotation-handler] {
  opacity: 0;
}

[resize-handler] {
  display: block;
  position: absolute;
  box-sizing: border-box;
  padding: 0;
  background: hsl(210, 20%, 98%);
  z-index: calc(infinity); /* should the handlers always show?  */

  &[resize-handler="top-left"], 
  &[resize-handler="top-right"], 
  &[resize-handler="bottom-right"], 
  &[resize-handler="bottom-left"] {
    width: 13px;
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
    border: 1.5px solid hsl(214, 84%, 56%);
    border-radius: 2px;
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
    cursor: var(--fc-nwse-resize, nwse-resize)
  }
    
  &[resize-handler="top-right"], &[resize-handler="bottom-left"] {
    cursor: var(--fc-nesw-resize, nesw-resize)
  }
}

[rotation-handler] {
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
  z-index: 2;
  cursor: url("data:image/svg+xml,<svg height='32' width='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg' style='color: black;'><defs><filter id='shadow' y='-40%' x='-40%' width='180px' height='180%' color-interpolation-filters='sRGB'><feDropShadow dx='1' dy='1' stdDeviation='1.2' flood-opacity='.5'/></filter></defs><g fill='none' transform='rotate(45 16 16)' filter='url(%23shadow)'><path d='M22.4789 9.45728L25.9935 12.9942L22.4789 16.5283V14.1032C18.126 14.1502 14.6071 17.6737 14.5675 22.0283H17.05L13.513 25.543L9.97889 22.0283H12.5674C12.6071 16.5691 17.0214 12.1503 22.4789 12.1031L22.4789 9.45728Z' fill='black'/><path fill-rule='evenodd' clip-rule='evenodd' d='M21.4789 7.03223L27.4035 12.9945L21.4789 18.9521V15.1868C18.4798 15.6549 16.1113 18.0273 15.649 21.0284H19.475L13.5128 26.953L7.55519 21.0284H11.6189C12.1243 15.8155 16.2679 11.6677 21.4789 11.1559L21.4789 7.03223ZM22.4789 12.1031C17.0214 12.1503 12.6071 16.5691 12.5674 22.0284H9.97889L13.513 25.543L17.05 22.0284H14.5675C14.5705 21.6896 14.5947 21.3558 14.6386 21.0284C15.1157 17.4741 17.9266 14.6592 21.4789 14.1761C21.8063 14.1316 22.1401 14.1069 22.4789 14.1032V16.5284L25.9935 12.9942L22.4789 9.45729L22.4789 12.1031Z' fill='white'/></g></svg>") 16 16, pointer;
}

[rotation-handler]::before {
  box-sizing: border-box;
  display: block;
  position: absolute;
  translate: -50% -150%;
  z-index: 2;
  border: 1px solid hsl(214, 84%, 56%);
  height: 50%;
  width: 1px;
}`);

// TODO: add z coordinate?
export class SpatialGeometry extends HTMLElement {
  static tagName = 'spatial-geometry';

  static register() {
    customElements.define(this.tagName, this);
  }

  static observedAttributes = ['type', 'x', 'y', 'width', 'height', 'rotate'];

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
    // Maybe can add the first resize handler here, and lazily instantiate the rest when needed?
    // I can see it becoming important at scale
    shadowRoot.innerHTML = `
<div>
  <button rotation-handler="top"></button>
  <button resize-handler="top-left"></button>
  <button resize-handler="top-right"></button>
  <button resize-handler="bottom-right"></button>
  <button resize-handler="bottom-left"></button>
  <slot />
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

  #previousWidth = 0;
  #width = 0;
  get width(): number {
    return this.#width;
  }

  set width(width: number) {
    this.setAttribute('width', width.toString());
  }

  #previousHeight = 0;
  #height = 0;
  get height(): number {
    return this.#height;
  }

  set height(height: number) {
    this.setAttribute('height', height.toString());
  }

  #previousRotate = 0;
  #rotate = 0;
  get rotate(): number {
    return this.#rotate;
  }

  set rotate(rotate: number) {
    this.setAttribute('rotate', rotate.toString());
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
    } else if (name === 'width') {
      this.#previousWidth = this.#width;
      this.#width = Number(newValue);
      this.#requestUpdate('width');
    } else if (name === 'height') {
      this.#previousHeight = this.#height;
      this.#height = Number(newValue);
      this.#requestUpdate('height');
    } else if (name === 'rotate') {
      this.#previousRotate = this.#rotate;
      this.#rotate = Number(newValue);
      this.#requestUpdate('rotate');
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
        const target = event.target as HTMLElement;

        if (target === null) return;

        if (target === this) {
          this.x += event.movementX;
          this.y += event.movementY;
          return;
        }

        const resizeDirection = target.getAttribute('resize-handler');

        if (resizeDirection !== null) {
          // This triggers a move and resize event :(
          if (resizeDirection.includes('top')) {
            this.y += event.movementY;
            this.height -= event.movementY;
          }

          if (resizeDirection.includes('right')) {
            this.width += event.movementX;
          }

          if (resizeDirection.includes('bottom')) {
            this.height += event.movementY;
          }

          if (resizeDirection.includes('left')) {
            this.x += event.movementX;
            this.width -= event.movementX;
          }
          return;
        }

        if (target.hasAttribute('rotation-handler')) {
          const centerX = (this.#x + this.#width) / 2;
          const centerY = (this.#y + this.#height) / 2;
          var newAngle =
            ((Math.atan2(event.clientY - centerY, event.clientX - centerX) + Math.PI / 2) * 180) /
            Math.PI;
          console.log(newAngle);
          this.rotate = newAngle;

          // When a rotation handler is
          // newAngle = (Math.atan2(centerY - mouseY, centerX - mouseX) * 180) / Math.PI - currentAngle;
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
