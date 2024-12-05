import { css, html } from './common/tags';
import { ResizeObserverManager } from './common/resize-observer';
import { Point } from './common/types';
import { RotatedDOMRectReadonly } from './common/rotated-dom-rect';
import { Vector } from './common/Vector';
import { getResizeCursorUrl, getRotateCursorUrl } from './common/cursors';

const resizeObserver = new ResizeObserverManager();

export type Shape = 'rectangle' | 'circle' | 'triangle';

type Handle =
  | 'resize-nw'
  | 'resize-ne'
  | 'resize-se'
  | 'resize-sw'
  | 'rotation-nw'
  | 'rotation-ne'
  | 'rotation-se'
  | 'rotation-sw'
  | 'move';

export type TransformEventDetail = {
  rotate: number;
};

// TODO: expose previous and current rects
export class TransformEvent extends Event {
  constructor() {
    super('transform', { cancelable: true, bubbles: true });
  }

  #xPrevented = false;
  get xPrevented() {
    return this.defaultPrevented || this.#xPrevented;
  }
  preventX() {
    this.#xPrevented = true;
  }

  #yPrevented = false;
  get yPrevented() {
    return this.defaultPrevented || this.#yPrevented;
  }
  preventY() {
    this.#yPrevented = true;
  }

  #heightPrevented = false;
  get heightPrevented() {
    return this.defaultPrevented || this.#heightPrevented;
  }
  preventHeight() {
    this.#heightPrevented = true;
  }

  #widthPrevented = false;
  get widthPrevented() {
    return this.defaultPrevented || this.#widthPrevented;
  }
  preventWidth() {
    this.#widthPrevented = true;
  }

  #rotatePrevented = false;
  get rotatePrevented() {
    return this.defaultPrevented || this.#rotatePrevented;
  }
  preventRotate() {
    this.#rotatePrevented = true;
  }
}

export type Dimension = number | 'auto';

const styles = css`
  :host {
    display: block;
    position: absolute;
    cursor: move;
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
    overflow: scroll;
    pointer-events: none;
  }

  ::slotted(*) {
    cursor: default;
    pointer-events: auto;
  }

  :host(:focus-within),
  :host(:focus-visible) {
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
    width: 9px;
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
    cursor: var(--resize-handle-cursor-nw);
  }

  [part='resize-ne'],
  [part='resize-sw'] {
    cursor: var(--resize-handle-cursor-ne);
  }

  [part^='rotation'] {
    z-index: calc(infinity);
    display: block;
    position: absolute;
    box-sizing: border-box;
    border-radius: 0px;
    padding: 0;
    opacity: 0;
    width: 16px;
    aspect-ratio: 1;
    cursor: var(--fc-rotate, url('${getRotateCursorUrl(0)}') 16 16, pointer);
  }

  [part='rotation-nw'] {
    top: 0;
    left: 0;
    translate: -100% -100%;
  }

  [part='rotation-ne'] {
    top: 0;
    left: 100%;
    translate: 0% -100%;
  }

  [part='rotation-se'] {
    top: 100%;
    left: 100%;
    translate: 0% 0%;
  }

  [part='rotation-sw'] {
    top: 100%;
    left: 0;
    translate: -100% 0%;
  }

  :host(:not(:focus-within)) [part^='resize'],
  :host(:not(:focus-within)) [part^='rotation'] {
    opacity: 0;
    cursor: default;
  }
`;

declare global {
  interface HTMLElementTagNameMap {
    'folk-shape': FolkShape;
  }
}

// TODO: add z coordinate?
export class FolkShape extends HTMLElement {
  static tagName = 'folk-shape';

  static define() {
    if (customElements.get(this.tagName)) return;
    customElements.define(this.tagName, this);
  }

  #shadow = this.attachShadow({ mode: 'open' });
  #internals = this.attachInternals();

  #dynamicStyles = css``;

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
      resizeObserver.observe(this, this.#onAutoResize);
    } else if (this.#width === 'auto' && this.#height !== 'auto') {
      resizeObserver.unobserve(this, this.#onAutoResize);
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
      resizeObserver.observe(this, this.#onAutoResize);
    } else if (this.#height === 'auto' && this.#width !== 'auto') {
      resizeObserver.unobserve(this, this.#onAutoResize);
    }

    this.#previousHeight = this.#height;
    this.#height = height;
    this.#requestUpdate('height');
  }

  #initialRotation = 0;
  #startAngle = 0;
  #previousRotation = 0;

  // use degrees in the DOM, but store in radians internally
  #rotation = (Number(this.getAttribute('rotation')) || 0) * (Math.PI / 180);

  get rotation(): number {
    return this.#rotation;
  }

  set rotation(rotation: number) {
    this.#previousRotation = this.#rotation;
    this.#rotation = rotation;
    this.#requestUpdate('rotation');
  }

  constructor() {
    super();

    this.addEventListener('pointerdown', this);
    this.addEventListener('keydown', this);

    this.#shadow.adoptedStyleSheets = [styles, this.#dynamicStyles];
    // Ideally we would creating these lazily on first focus, but the resize handlers need to be around for delegate focus to work.
    // Maybe can add the first resize handler here, and lazily instantiate the rest when needed?
    // I can see it becoming important at scale
    this.#shadow.innerHTML = html` <button part="rotation-nw" tabindex="-1"></button>
      <button part="rotation-ne" tabindex="-1"></button>
      <button part="rotation-se" tabindex="-1"></button>
      <button part="rotation-sw" tabindex="-1"></button>
      <button part="resize-nw" aria-label="Resize shape from top left"></button>
      <button part="resize-ne" aria-label="Resize shape from top right"></button>
      <button part="resize-se" aria-label="Resize shape from bottom right"></button>
      <button part="resize-sw" aria-label="Resize shape from bottom left"></button>
      <div><slot></slot></div>`;

    this.height = Number(this.getAttribute('height')) || 'auto';
    this.width = Number(this.getAttribute('width')) || 'auto';
  }

  #isConnected = false;
  connectedCallback() {
    this.setAttribute('tabindex', '0');
    this.#isConnected = true;
    this.#update(new Set(['type', 'x', 'y', 'height', 'width', 'rotation']));
  }

  getClientRect() {
    const { x, y, width, height, rotation } = this;

    return new RotatedDOMRectReadonly({ x, y, width, height, rotation });
  }

  // Similar to `Element.getClientBoundingRect()`, but returns an SVG path that precisely outlines the shape.
  getBoundingPath(): string {
    return '';
  }

  // We might also want some kind of utility function that maps a path into an approximate set of vertices.
  getBoundingVertices() {
    return [];
  }

  handleEvent(event: PointerEvent | KeyboardEvent) {
    if (event instanceof KeyboardEvent) {
      const MOVEMENT_DELTA = event.shiftKey ? 20 : 2;
      const ROTATION_DELTA = event.shiftKey ? Math.PI / 12 : Math.PI / 36; // 15 or 5 degrees

      // Get the focused element to check if it's a resize handle
      const focusedElement = this.#shadow.activeElement;
      const handle = focusedElement?.getAttribute('part') as Handle | null;

      // Create synthetic mouse coordinates for keyboard events
      let syntheticMouse: Point | null = null;

      if (handle?.startsWith('resize')) {
        const anyChange =
          event.key === 'ArrowUp' ||
          event.key === 'ArrowDown' ||
          event.key === 'ArrowLeft' ||
          event.key === 'ArrowRight';
        if (!anyChange) return;

        // Get the corner coordinates of the shape for the corresponding handle
        const rect = this.getClientRect();

        // Map handle names to corner indices
        const handleToCornerIndex: Record<string, Point> = {
          'resize-nw': rect.topLeft,
          'resize-ne': rect.topRight,
          'resize-se': rect.bottomRight,
          'resize-sw': rect.bottomLeft,
        };

        const currentPos = handleToCornerIndex[handle];

        // Calculate movement based on arrow keys
        const isVertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
        const isIncreasing = event.key === 'ArrowRight' || event.key === 'ArrowDown';
        const delta = isIncreasing ? MOVEMENT_DELTA : -MOVEMENT_DELTA;

        syntheticMouse = {
          x: currentPos.x + (isVertical ? 0 : delta),
          y: currentPos.y + (isVertical ? delta : 0),
        };

        // Process resize using the same logic as mouse events
        this.#handleResize(handle, syntheticMouse, focusedElement as HTMLElement);
        event.preventDefault();
        return;
      }

      // Handle rotation with Alt key
      if (event.altKey) {
        switch (event.key) {
          case 'ArrowLeft':
            this.rotation -= ROTATION_DELTA;
            event.preventDefault();
            return;
          case 'ArrowRight':
            this.rotation += ROTATION_DELTA;
            event.preventDefault();
            return;
        }
      }

      switch (event.key) {
        case 'ArrowLeft':
          this.x -= MOVEMENT_DELTA;
          event.preventDefault();
          return;
        case 'ArrowRight':
          this.x += MOVEMENT_DELTA;
          event.preventDefault();
          return;
        case 'ArrowUp':
          this.y -= MOVEMENT_DELTA;
          event.preventDefault();
          return;
        case 'ArrowDown':
          this.y += MOVEMENT_DELTA;
          event.preventDefault();
          return;
      }
      return;
    }

    if (event instanceof PointerEvent) {
      switch (event.type) {
        case 'pointerdown': {
          if (event.button !== 0 || event.ctrlKey) return;

          const target = event.composedPath()[0] as HTMLElement;

          // Store initial angle on rotation start
          if (target.getAttribute('part')?.startsWith('rotation')) {
            const center = this.getClientRect().center;
            this.#initialRotation = this.#rotation;
            this.#startAngle = Vector.angleFromOrigin({ x: event.clientX, y: event.clientY }, center);
          }

          // ignore interactions from slotted elements.
          if (target !== this && !target.hasAttribute('part')) return;

          target.addEventListener('pointermove', this);
          target.addEventListener('lostpointercapture', this);
          target.setPointerCapture(event.pointerId);

          const interaction = target.getAttribute('part') || 'move';
          this.#internals.states.add(interaction);

          this.focus();
          return;
        }
        case 'pointermove': {
          const target = event.composedPath()[0] as HTMLElement;
          if (target === null) return;

          if (target === this) {
            this.x += event.movementX;
            this.y += event.movementY;
            return;
          }

          const handle = target.getAttribute('part') as Handle;
          if (handle === null) return;

          if (handle.includes('resize')) {
            const mouse = { x: event.clientX, y: event.clientY };
            this.#handleResize(handle, mouse, target, event);
            return;
          }

          if (handle.startsWith('rotation')) {
            const center = this.getClientRect().center;
            const currentAngle = Vector.angleFromOrigin({ x: event.clientX, y: event.clientY }, center);
            this.rotation = this.#initialRotation + (currentAngle - this.#startAngle);

            let degrees = (this.rotation * 180) / Math.PI;
            switch (handle) {
              case 'rotation-ne':
                degrees = (degrees + 90) % 360;
                break;
              case 'rotation-se':
                degrees = (degrees + 180) % 360;
                break;
              case 'rotation-sw':
                degrees = (degrees + 270) % 360;
                break;
            }

            const target = event.composedPath()[0] as HTMLElement;
            const rotateCursor = getRotateCursorUrl(degrees);
            target.style.setProperty('cursor', rotateCursor);

            return;
          }

          return;
        }
        case 'lostpointercapture': {
          const target = event.composedPath()[0] as HTMLElement;
          const interaction = target.getAttribute('part') || 'move';
          this.#internals.states.delete(interaction);
          target.removeEventListener('pointermove', this);
          target.removeEventListener('lostpointercapture', this);

          this.#updateCursors();
          if (target.getAttribute('part')?.startsWith('rotation')) {
            target.style.removeProperty('cursor');
          }

          return;
        }
      }
    }
  }

  #updatedProperties = new Set<string>();
  #isUpdating = false;

  async #requestUpdate(property: string) {
    if (!this.#isConnected) return;

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
    this.#dispatchTransformEvent(updatedProperties);
  }

  #dispatchTransformEvent(updatedProperties: Set<string>) {
    const event = new TransformEvent();

    this.dispatchEvent(event);

    if (updatedProperties.has('x')) {
      if (event.xPrevented) {
        this.#x = this.#previousX;
      } else {
        this.style.left = `${this.#x}px`;
      }
    }

    if (updatedProperties.has('y')) {
      if (event.yPrevented) {
        this.#y = this.#previousY;
      } else {
        this.style.top = `${this.#y}px`;
      }
    }

    if (updatedProperties.has('height')) {
      if (event.heightPrevented) {
        this.#height = this.#previousHeight;
      } else {
        this.style.height = this.#height === 'auto' ? '' : `${this.#height}px`;
      }
    }

    if (updatedProperties.has('width')) {
      if (event.widthPrevented) {
        this.#width = this.#previousWidth;
      } else {
        this.style.width = this.#width === 'auto' ? '' : `${this.#width}px`;
      }
    }

    if (updatedProperties.has('rotation')) {
      if (event.rotatePrevented) {
        this.#rotation = this.#previousRotation;
      } else {
        this.style.rotate = `${this.#rotation}rad`;
      }
    }
  }

  #onAutoResize = (entry: ResizeObserverEntry) => {
    const previousRect = this.#autoContentRect;
    this.#autoContentRect = entry.contentRect;
    this.#previousHeight = previousRect.height;
    this.#previousWidth = previousRect.width;
    this.#dispatchTransformEvent(new Set(['width', 'height']));
  };

  #updateCursors() {
    const degrees = (this.#rotation * 180) / Math.PI;

    const resizeCursor0 = getResizeCursorUrl(degrees);
    const resizeCursor90 = getResizeCursorUrl((degrees + 90) % 360);
    const rotateCursor0 = getRotateCursorUrl(degrees);
    const rotateCursor90 = getRotateCursorUrl((degrees + 90) % 360);
    const rotateCursor180 = getRotateCursorUrl((degrees + 180) % 360);
    const rotateCursor270 = getRotateCursorUrl((degrees + 270) % 360);

    const dynamicStyles = `
      [part='resize-nw'],
      [part='resize-se'] {
        cursor: ${resizeCursor0};
      }

      [part='resize-ne'],
      [part='resize-sw'] {
        cursor: ${resizeCursor90};
      }

      [part='rotation-nw'] {
        cursor: ${rotateCursor0};
      }

      [part='rotation-ne'] {
        cursor: ${rotateCursor90};
      }

      [part='rotation-se'] {
        cursor: ${rotateCursor180};
      }

      [part='rotation-sw'] {
        cursor: ${rotateCursor270};
      }
    `;

    this.#dynamicStyles.replaceSync(dynamicStyles);
  }

  // Updated helper method to handle resize operations
  #handleResize(handle: Handle, mouse: Point, target: HTMLElement, event?: PointerEvent) {
    const rect = this.getClientRect();

    // Map each resize handle to its opposite corner index
    const OPPOSITE_CORNERS = {
      'resize-se': rect.topLeft,
      'resize-sw': rect.topRight,
      'resize-nw': rect.bottomRight,
      'resize-ne': rect.bottomLeft,
    } as const;

    // Get the opposite corner for the current resize handle
    const oppositeCorner = OPPOSITE_CORNERS[handle as keyof typeof OPPOSITE_CORNERS];

    // Calculate new dimensions based on mouse position and opposite corner
    const newCenter = Vector.lerp(oppositeCorner, mouse, 0.5);
    const unrotatedHandle = Vector.rotateAround(mouse, newCenter, -this.rotation);
    const unrotatedAnchor = Vector.rotateAround(oppositeCorner, newCenter, -this.rotation);

    const HANDLE_BEHAVIOR = {
      'resize-se': {
        flipX: unrotatedHandle.x < unrotatedAnchor.x,
        flipY: unrotatedHandle.y < unrotatedAnchor.y,
        handleX: 'resize-sw',
        handleY: 'resize-ne',
      },
      'resize-sw': {
        flipX: unrotatedHandle.x > unrotatedAnchor.x,
        flipY: unrotatedHandle.y < unrotatedAnchor.y,
        handleX: 'resize-se',
        handleY: 'resize-nw',
      },
      'resize-nw': {
        flipX: unrotatedHandle.x > unrotatedAnchor.x,
        flipY: unrotatedHandle.y > unrotatedAnchor.y,
        handleX: 'resize-ne',
        handleY: 'resize-sw',
      },
      'resize-ne': {
        flipX: unrotatedHandle.x < unrotatedAnchor.x,
        flipY: unrotatedHandle.y > unrotatedAnchor.y,
        handleX: 'resize-nw',
        handleY: 'resize-se',
      },
    } as const;

    // Handle flipping logic
    const behavior = HANDLE_BEHAVIOR[handle as keyof typeof HANDLE_BEHAVIOR];
    const hasFlippedX = behavior.flipX;
    const hasFlippedY = behavior.flipY;

    if (hasFlippedX || hasFlippedY) {
      const nextHandle = hasFlippedX ? behavior.handleX : behavior.handleY;
      const newTarget = this.#shadow.querySelector(`[part="${nextHandle}"]`) as HTMLElement;

      if (newTarget) {
        // Update focus for keyboard events
        newTarget.focus();

        // Update handle state
        this.#internals.states.delete(handle);
        this.#internals.states.add(nextHandle);

        // Handle pointer capture swap for mouse events
        if (event && 'setPointerCapture' in target) {
          // Clean up old handle state
          target.removeEventListener('pointermove', this);
          target.removeEventListener('lostpointercapture', this);

          // Set up new handle state
          newTarget.addEventListener('pointermove', this);
          newTarget.addEventListener('lostpointercapture', this);

          // Transfer pointer capture
          target.releasePointerCapture(event.pointerId);
          newTarget.setPointerCapture(event.pointerId);
        }
      }
    }

    // Update dimensions
    this.x = Math.min(unrotatedHandle.x, unrotatedAnchor.x);
    this.y = Math.min(unrotatedHandle.y, unrotatedAnchor.y);
    this.width = Math.abs(unrotatedAnchor.x - unrotatedHandle.x);
    this.height = Math.abs(unrotatedAnchor.y - unrotatedHandle.y);
  }
}
