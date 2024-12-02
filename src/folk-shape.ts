import { css, html } from './common/tags';
import { ResizeObserverManager } from './common/resize-observer';
import type { Vector2 } from './common/Vector2';

const resizeObserver = new ResizeObserverManager();

export type Shape = 'rectangle' | 'circle' | 'triangle';

type RotatedDOMRect = DOMRect & {
  // In degrees
  rotation: number;

  // Returns the center point in worldspace coordinates
  center(): Vector2;

  // Returns the four corners in worldspace coordinates, in clockwise order
  corners(): [Vector2, Vector2, Vector2, Vector2];

  // Returns all the vertices in worldspace coordinates
  vertices(): Vector2[];
};
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

export type Dimension = number | 'auto';

const styles = new CSSStyleSheet();
styles.replaceSync(css`
  :host {
    display: block;
    position: absolute;
    cursor: var(--fc-move, move);
    box-sizing: border-box;
  }

  :host::before {
    content: '';
    position: absolute;
    inset: -15px -15px -15px -15px;
    z-index: -1;
  }

  div {
    height: 100%;
    width: 100%;
    overflow: hidden;
    cursor: default;
  }

  :host(:focus-within) {
    z-index: calc(infinity - 1);
    outline: solid 1px hsl(214, 84%, 56%);
  }

  :host(:hover) {
    outline: solid 2px hsl(214, 84%, 56%);
  }

  :host(:state(move)),
  :host(:state(rotate)),
  :host(:state(resize-nw)),
  :host(:state(resize-ne)),
  :host(:state(resize-se)),
  :host(:state(resize-sw)) {
    user-select: none;
  }

  [part='resize-nw'],
  [part='resize-ne'],
  [part='resize-se'],
  [part='resize-sw'] {
    display: block;
    position: absolute;
    box-sizing: border-box;
    padding: 0;
    background: hsl(210, 20%, 98%);
    z-index: calc(infinity);
    width: 13px;
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
    border: 1.5px solid hsl(214, 84%, 56%);
    border-radius: 2px;
  }

  [part='resize-nw'] {
    top: 0;
    left: 0;
  }

  [part='resize-ne'] {
    top: 0;
    left: 100%;
  }

  [part='resize-se'] {
    top: 100%;
    left: 100%;
  }

  [part='resize-sw'] {
    top: 100%;
    left: 0;
  }

  [part='resize-nw'],
  [part='resize-se'] {
    cursor: var(--fc-nwse-resize, nwse-resize);
  }

  [part='resize-ne'],
  [part='resize-sw'] {
    cursor: var(--fc-nesw-resize, nesw-resize);
  }

  [part='rotate'] {
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
    cursor: url("data:image/svg+xml,<svg height='32' width='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg' style='color: black;'><defs><filter id='shadow' y='-40%' x='-40%' width='180px' height='180%' color-interpolation-filters='sRGB'><feDropShadow dx='1' dy='1' stdDeviation='1.2' flood-opacity='.5'/></filter></defs><g fill='none' transform='rotate(45 16 16)' filter='url(%23shadow)'><path d='M22.4789 9.45728L25.9935 12.9942L22.4789 16.5283V14.1032C18.126 14.1502 14.6071 17.6737 14.5675 22.0283H17.05L13.513 25.543L9.97889 22.0283H12.5674C12.6071 16.5691 17.0214 12.1503 22.4789 12.1031L22.4789 9.45728Z' fill='black'/><path fill-rule='evenodd' clip-rule='evenodd' d='M21.4789 7.03223L27.4035 12.9945L21.4789 18.9521V15.1868C18.4798 15.6549 16.1113 18.0273 15.649 21.0284H19.475L13.5128 26.953L7.55519 21.0284H11.6189C12.1243 15.8155 16.2679 11.6677 21.4789 11.1559L21.4789 7.03223ZM22.4789 12.1031C17.0214 12.1503 12.6071 16.5691 12.5674 22.0284H9.97889L13.513 25.543L17.05 22.0284H14.5675C14.5705 21.6896 14.5947 21.3558 14.6386 21.0284C15.1157 17.4741 17.9266 14.6592 21.4789 14.1761C21.8063 14.1316 22.1401 14.1069 22.4789 14.1032V16.5284L25.9935 12.9942L22.4789 9.45729L22.4789 12.1031Z' fill='white'/></g></svg>")
        16 16,
      pointer;
  }

  :host(:not(:focus-within)) [part^='resize'],
  :host(:not(:focus-within)) [part='rotate'] {
    opacity: 0;
    cursor: default;
  }
`);

declare global {
  interface HTMLElementTagNameMap {
    'folk-shape': FolkShape;
  }
}

// TODO: add z coordinate?
export class FolkShape extends HTMLElement {
  static tagName = 'folk-shape';

  static define() {
    customElements.define(this.tagName, this);
  }

  #internals = this.attachInternals();

  #type = (this.getAttribute('type') || 'rectangle') as Shape;
  get type(): Shape {
    return this.#type;
  }

  set type(type: Shape) {
    this.setAttribute('type', type);
  }

  #previousX = 0;
  #x = Number(this.getAttribute('x')) || 0;
  get x() {
    return this.#x;
  }

  set x(x) {
    this.#previousX = this.#x;
    this.#x = x;
    this.#requestUpdate('x');
  }

  #previousY = 0;
  #y = Number(this.getAttribute('y')) || 0;
  get y() {
    return this.#y;
  }

  set y(y) {
    this.#previousY = this.#y;
    this.#y = y;
    this.#requestUpdate('y');
  }

  #autoContentRect = this.getBoundingClientRect();

  #previousWidth: Dimension = 0;
  #width: Dimension = 0;
  get width(): number {
    if (this.#width === 'auto') {
      return this.#autoContentRect.width;
    }
    return this.#width;
  }

  set width(width: Dimension) {
    if (width === 'auto') {
      resizeObserver.observe(this, this.#onResize);
    } else if (this.#width === 'auto' && this.#height !== 'auto') {
      resizeObserver.unobserve(this, this.#onResize);
    }
    this.#previousWidth = this.#width;
    this.#width = width;
    this.#requestUpdate('width');
  }

  #previousHeight: Dimension = 0;
  #height: Dimension = 0;
  get height(): number {
    if (this.#height === 'auto') {
      return this.#autoContentRect.height;
    }
    return this.#height;
  }

  set height(height: Dimension) {
    if (height === 'auto') {
      resizeObserver.observe(this, this.#onResize);
    } else if (this.#height === 'auto' && this.#width !== 'auto') {
      resizeObserver.unobserve(this, this.#onResize);
    }

    this.#previousHeight = this.#height;
    this.#height = height;
    this.#requestUpdate('height');
  }

  #initialRotation = 0;
  #startAngle = 0;
  #previousRotation = 0;

  // TODO: consider using radians instead of degrees
  #rotation = Number(this.getAttribute('rotate')) || 0;

  get rotation(): number {
    return this.#rotation;
  }

  set rotation(rotation: number) {
    this.#previousRotation = this.#rotation;
    this.#rotation = rotation;
    this.#requestUpdate('rotate');
  }

  constructor() {
    super();

    this.addEventListener('pointerdown', this);

    const shadowRoot = this.attachShadow({
      mode: 'open',
      delegatesFocus: true,
    });
    shadowRoot.adoptedStyleSheets.push(styles);
    // Ideally we would creating these lazily on first focus, but the resize handlers need to be around for delegate focus to work.
    // Maybe can add the first resize handler here, and lazily instantiate the rest when needed?
    // I can see it becoming important at scale
    shadowRoot.innerHTML = html` <button part="rotate"></button>
      <button part="resize-nw"></button>
      <button part="resize-ne"></button>
      <button part="resize-se"></button>
      <button part="resize-sw"></button>
      <div><slot></slot></div>`;

    this.height = Number(this.getAttribute('height')) || 'auto';
    this.width = Number(this.getAttribute('width')) || 'auto';
  }

  connectedCallback() {
    this.#update(new Set(['type', 'x', 'y', 'height', 'width', 'rotate']));
  }

  getClientRect(): RotatedDOMRect {
    const { x, y, width, height, rotation } = this;
    const radians = (rotation * Math.PI) / 180;

    return {
      x,
      y,
      width,
      height,
      left: x,
      top: y,
      right: x + width,
      bottom: y + height,
      rotation,

      center(): Vector2 {
        return {
          x: this.x + this.width / 2,
          y: this.y + this.height / 2,
        };
      },
      vertices(): Vector2[] {
        // TODO: Implement
        return [];
      },

      corners(): [Vector2, Vector2, Vector2, Vector2] {
        const center = this.center();
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);

        const halfWidth = this.width / 2;
        const halfHeight = this.height / 2;

        // Helper to rotate a point around the center
        const rotatePoint = (dx: number, dy: number): Vector2 => ({
          x: center.x + dx * cos - dy * sin,
          y: center.y + dx * sin + dy * cos,
        });

        // Return vertices in clockwise order: top-left, top-right, bottom-right, bottom-left
        return [
          rotatePoint(-halfWidth, -halfHeight), // Top-left
          rotatePoint(halfWidth, -halfHeight), // Top-right
          rotatePoint(halfWidth, halfHeight), // Bottom-right
          rotatePoint(-halfWidth, halfHeight), // Bottom-left
        ];
      },

      toJSON: undefined as any,
    };
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

        // Store initial angle on rotation start
        if (target.getAttribute('part') === 'rotate') {
          // We need to store initial rotation/angle somewhere.
          // This is a little awkward as we'll want to do *quite a lot* of this kind of thing.
          // Might be an argument for making elements dumber (i.e. not have them manage their own state) and do this from the outside.
          // But we also want to preserve the self-sufficient nature of elements' behaviour...
          // Maybe some kind of shared utility, used by both the element and the outside environment?
          this.#initialRotation = this.#rotation;
          const centerX = this.#x + this.width / 2;
          const centerY = this.#y + this.height / 2;
          this.#startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
        }

        // ignore interactions from slotted elements.
        if (target !== this && !target.hasAttribute('part')) return;

        target.addEventListener('pointermove', this);
        this.addEventListener('lostpointercapture', this);
        target.setPointerCapture(event.pointerId);

        const interaction = target.getAttribute('part') || 'move';
        this.#internals.states.add(interaction);

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
          console.log(part, event.movementX, event.movementY);
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
          const centerX = this.#x + this.width / 2;
          const centerY = this.#y + this.height / 2;
          const currentAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX);

          const deltaAngle = currentAngle - this.#startAngle;
          this.rotation = this.#initialRotation + (deltaAngle * 180) / Math.PI;
          return;
        }

        return;
      }
      case 'lostpointercapture': {
        const target = event.composedPath()[0] as HTMLElement;
        const interaction = target.getAttribute('part') || 'move';
        this.#internals.states.delete(interaction);
        target.removeEventListener('pointermove', this);
        this.removeEventListener('lostpointercapture', this);
        return;
      }
    }
  }

  #updatedProperties = new Set<string>();
  #isUpdating = false;

  async #requestUpdate(property: string) {
    this.#updatedProperties.add(property);

    if (this.#isUpdating) return;

    this.#isUpdating = true;
    await true;
    this.#isUpdating = false;
    this.#update(this.#updatedProperties);
    this.#updatedProperties.clear();
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
          movementX: this.width - (this.#previousWidth === 'auto' ? 0 : this.#previousWidth),
          movementY: this.height - (this.#previousHeight === 'auto' ? 0 : this.#previousHeight),
        })
      );
      if (notCancelled) {
        if (updatedProperties.has('width')) {
          this.style.width = this.#width === 'auto' ? '' : `${this.#width}px`;
        }

        if (updatedProperties.has('height')) {
          this.style.height = this.#height === 'auto' ? '' : `${this.#height}px`;
        }
      } else {
        // TODO: Revert changes to position too
        this.#height = this.#previousHeight;
        this.#width = this.#previousWidth;
      }
    }

    if (updatedProperties.has('rotate')) {
      // Although the change in resize isn't useful inside this component, the outside world might find it helpful to calculate acceleration and other physics
      const notCancelled = this.dispatchEvent(new RotateEvent({ rotate: this.#rotation - this.#previousRotation }));

      if (notCancelled) {
        if (updatedProperties.has('rotate')) {
          this.style.rotate = `${this.#rotation}deg`;
        }
      } else {
        this.#rotation = this.#previousRotation;
      }
    }
  }

  #onResize = (entry: ResizeObserverEntry) => {
    const previousRect = this.#autoContentRect;
    this.#autoContentRect = entry.contentRect;

    const notCancelled = this.dispatchEvent(
      new ResizeEvent({
        movementX: this.width - (this.#previousWidth === 'auto' ? previousRect.width : this.#previousWidth),
        movementY: this.height - (this.#previousHeight === 'auto' ? previousRect.height : this.#previousHeight),
      })
    );

    if (!notCancelled) {
      if (this.#height === 'auto') {
        this.height = previousRect?.height || 0;
      }

      if (this.#width === 'auto') {
        this.width = previousRect?.width || 0;
      }
    }
  };
}
