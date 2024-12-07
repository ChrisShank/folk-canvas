import { css, html } from './common/tags';
import { ResizeObserverManager } from './common/resize-observer';
import { Point } from './common/types';
import { DOMRectTransform, DOMRectTransformReadonly } from './common/DOMRectTransform';
import { Vector } from './common/Vector';
import { getResizeCursorUrl, getRotateCursorUrl } from './common/cursors';
import { TransformEvent } from './common/TransformEvent';

const resizeObserver = new ResizeObserverManager();

type ResizeHandle = 'resize-top-left' | 'resize-top-right' | 'resize-bottom-right' | 'resize-bottom-left';
type RotateHandle = 'rotation-top-left' | 'rotation-top-right' | 'rotation-bottom-right' | 'rotation-bottom-left';
type Handle = ResizeHandle | RotateHandle | 'move';
export type Dimension = number | 'auto';

type HandleMap = Record<ResizeHandle, ResizeHandle>;

const oppositeHandleMap: HandleMap = {
  'resize-bottom-right': 'resize-top-left',
  'resize-bottom-left': 'resize-top-right',
  'resize-top-left': 'resize-bottom-right',
  'resize-top-right': 'resize-bottom-left',
};

const flipXHandleMap: HandleMap = {
  'resize-bottom-right': 'resize-bottom-left',
  'resize-bottom-left': 'resize-bottom-right',
  'resize-top-left': 'resize-top-right',
  'resize-top-right': 'resize-top-left',
};

const flipYHandleMap: HandleMap = {
  'resize-bottom-right': 'resize-top-right',
  'resize-bottom-left': 'resize-top-left',
  'resize-top-left': 'resize-bottom-left',
  'resize-top-right': 'resize-bottom-right',
};

const styles = css`
  :host {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    cursor: move;
    box-sizing: border-box;
    transform-origin: 0 0;
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
  :host(:state(resize-top-left)),
  :host(:state(resize-top-right)),
  :host(:state(resize-bottom-right)),
  :host(:state(resize-bottom-left)) {
    user-select: none;
  }

  [part='resize-top-left'],
  [part='resize-top-right'],
  [part='resize-bottom-right'],
  [part='resize-bottom-left'] {
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

  [part='resize-top-left'] {
    top: 0;
    left: 0;
  }

  [part='resize-top-right'] {
    top: 0;
    left: 100%;
  }

  [part='resize-bottom-right'] {
    top: 100%;
    left: 100%;
  }

  [part='resize-bottom-left'] {
    top: 100%;
    left: 0;
  }

  [part='resize-top-left'],
  [part='resize-bottom-right'] {
    cursor: var(--resize-handle-cursor-nw);
  }

  [part='resize-top-right'],
  [part='resize-bottom-left'] {
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

  [part='rotation-top-left'] {
    top: 0;
    left: 0;
    translate: -100% -100%;
  }

  [part='rotation-top-right'] {
    top: 0;
    left: 100%;
    translate: 0% -100%;
  }

  [part='rotation-bottom-right'] {
    top: 100%;
    left: 100%;
    translate: 0% 0%;
  }

  [part='rotation-bottom-left'] {
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

export class FolkShape extends HTMLElement {
  static tagName = 'folk-shape';

  static define() {
    if (customElements.get(this.tagName)) return;
    customElements.define(this.tagName, this);
  }

  #shadow = this.attachShadow({ mode: 'open' });
  #internals = this.attachInternals();
  #dynamicStyles = css``;

  #attrWidth: Dimension = 0;
  #attrHeight: Dimension = 0;

  #rect = new DOMRectTransform();
  #previousRect = new DOMRectTransform();

  // Used for rotation handling, would love a better way to do this that avoids this clutter.
  #initialRotation = 0;
  #startAngle = 0;

  get x() {
    return this.#rect.x;
  }

  set x(x) {
    this.#previousRect.x = this.#rect.x;
    this.#rect.x = x;
    this.#requestUpdate();
  }

  get y() {
    return this.#rect.y;
  }

  set y(y) {
    this.#previousRect.y = this.#rect.y;
    this.#rect.y = y;
    this.#requestUpdate();
  }

  get width(): number {
    return this.#rect.width;
  }

  set width(width: Dimension) {
    if (width === 'auto') {
      resizeObserver.observe(this, this.#onAutoResize);
    } else if (this.#attrWidth === 'auto' && this.#attrHeight !== 'auto') {
      resizeObserver.unobserve(this, this.#onAutoResize);
    } else {
      this.#previousRect.width = this.#rect.width;
      this.#rect.width = width;
    }
    this.#attrWidth = width;
    this.#requestUpdate();
  }

  get height(): number {
    return this.#rect.height;
  }

  set height(height: Dimension) {
    if (height === 'auto') {
      resizeObserver.observe(this, this.#onAutoResize);
    } else if (this.#attrHeight === 'auto' && this.#attrWidth !== 'auto') {
      resizeObserver.unobserve(this, this.#onAutoResize);
    } else {
      this.#previousRect.height = this.#rect.height;
      this.#rect.height = height;
    }

    this.#attrHeight = height;
    this.#requestUpdate();
  }

  get rotation(): number {
    return this.#rect.rotation;
  }

  set rotation(rotation: number) {
    this.#previousRect.rotation = this.#rect.rotation;
    this.#rect.rotation = rotation;
    this.#requestUpdate();
  }

  constructor() {
    super();

    this.addEventListener('pointerdown', this);
    this.addEventListener('keydown', this);

    this.#shadow.adoptedStyleSheets = [styles, this.#dynamicStyles];
    // Ideally we would creating these lazily on first focus, but the resize handlers need to be around for delegate focus to work.
    // Maybe can add the first resize handler here, and lazily instantiate the rest when needed?
    // I can see it becoming important at scale
    this.#shadow.innerHTML = html` <button part="rotation-top-left" tabindex="-1"></button>
      <button part="rotation-top-right" tabindex="-1"></button>
      <button part="rotation-bottom-right" tabindex="-1"></button>
      <button part="rotation-bottom-left" tabindex="-1"></button>
      <button part="resize-top-left" aria-label="Resize shape from top left"></button>
      <button part="resize-top-right" aria-label="Resize shape from top right"></button>
      <button part="resize-bottom-right" aria-label="Resize shape from bottom right"></button>
      <button part="resize-bottom-left" aria-label="Resize shape from bottom left"></button>
      <div><slot></slot></div>`;

    this.x = Number(this.getAttribute('x')) || 0;
    this.y = Number(this.getAttribute('y')) || 0;
    this.width = Number(this.getAttribute('width')) || 'auto';
    this.height = Number(this.getAttribute('height')) || 'auto';
    this.rotation = (Number(this.getAttribute('rotation')) || 0) * (Math.PI / 180);

    this.#rect.transformOrigin = { x: 0, y: 0 };
    this.#rect.rotateOrigin = { x: 0.5, y: 0.5 };

    this.#previousRect = new DOMRectTransform(this.#rect);
  }

  #isConnected = false;
  connectedCallback() {
    this.setAttribute('tabindex', '0');
    this.#isConnected = true;
    this.#update();
  }

  getTransformDOMRectReadonly() {
    return new DOMRectTransformReadonly(this.#rect);
  }
  getTransformDOMRect() {
    return this.#rect;
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
        const rect = this.#rect;

        let vector: Point;
        switch (event.key) {
          case 'ArrowUp':
            vector = { x: 0, y: -MOVEMENT_DELTA };
            break;
          case 'ArrowDown':
            vector = { x: 0, y: MOVEMENT_DELTA };
            break;
          case 'ArrowLeft':
            vector = { x: -MOVEMENT_DELTA, y: 0 };
            break;
          case 'ArrowRight':
            vector = { x: MOVEMENT_DELTA, y: 0 };
            break;
        }

        // Map handle names to corner points
        const HANDLE_TO_CORNER: Record<string, Point> = {
          'resize-top-left': rect.topLeft,
          'resize-top-right': rect.topRight,
          'resize-bottom-right': rect.bottomRight,
          'resize-bottom-left': rect.bottomLeft,
        };

        const currentPos = rect.toParentSpace(HANDLE_TO_CORNER[handle]);

        const syntheticMouse = {
          x: currentPos.x,
          y: currentPos.y,
        };

        // Calculate movement based on arrow keys

        // Process resize using the same logic as mouse events
        this.#handleResize(handle as ResizeHandle, syntheticMouse, focusedElement as HTMLElement);
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
            this.#initialRotation = this.#rect.rotation;
            // Calculate the absolute rotation origin in parent space
            const parentRotateOrigin = this.#rect.toParentSpace({
              x: this.#rect.width * this.#rect.rotateOrigin.x,
              y: this.#rect.height * this.#rect.rotateOrigin.y,
            });
            this.#startAngle = Vector.angleFromOrigin({ x: event.clientX, y: event.clientY }, parentRotateOrigin);
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

          if (handle.startsWith('resize')) {
            const mouse = { x: event.clientX, y: event.clientY };
            this.#handleResize(handle as ResizeHandle, mouse, target, event);
            return;
          }

          if (handle.startsWith('rotation')) {
            // Calculate the absolute rotation origin in parent space
            const parentRotateOrigin = this.#rect.toParentSpace({
              x: this.#rect.width * this.#rect.rotateOrigin.x,
              y: this.#rect.height * this.#rect.rotateOrigin.y,
            });
            const currentAngle = Vector.angleFromOrigin({ x: event.clientX, y: event.clientY }, parentRotateOrigin);
            const rotation = this.#initialRotation + (currentAngle - this.#startAngle);

            let cursorRotation = (rotation * 180) / Math.PI;
            switch (handle) {
              case 'rotation-top-right':
                cursorRotation = (cursorRotation + 90) % 360;
                break;
              case 'rotation-bottom-right':
                cursorRotation = (cursorRotation + 180) % 360;
                break;
              case 'rotation-bottom-left':
                cursorRotation = (cursorRotation + 270) % 360;
                break;
              // top-left handle doesn't need adjustment
            }

            const target = event.composedPath()[0] as HTMLElement;
            const rotateCursor = getRotateCursorUrl(cursorRotation);
            target.style.setProperty('cursor', rotateCursor);
            this.rotation = rotation;
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

  #isUpdating = false;

  async #requestUpdate() {
    if (!this.#isConnected) return;

    if (this.#isUpdating) return;

    this.#isUpdating = true;
    await true;
    this.#isUpdating = false;
    this.#update();
  }

  // Any updates that should be batched should happen here like updating the DOM or emitting events should be executed here.
  #update() {
    this.#dispatchTransformEvent();
  }

  #dispatchTransformEvent() {
    const event = new TransformEvent(this.#rect, this.#previousRect);
    this.dispatchEvent(event);

    if (event.xPrevented) {
      this.#rect.x = this.#previousRect.x;
    }
    if (event.yPrevented) {
      this.#rect.y = this.#previousRect.y;
    }
    if (event.widthPrevented) {
      this.#rect.width = this.#previousRect.width;
    }
    if (event.heightPrevented) {
      this.#rect.height = this.#previousRect.height;
    }
    if (event.rotatePrevented) {
      this.#rect.rotation = this.#previousRect.rotation;
    }

    this.style.transform = this.#rect.toCssString();
    this.style.width = this.#attrWidth === 'auto' ? '' : `${this.#rect.width}px`;
    this.style.height = this.#attrHeight === 'auto' ? '' : `${this.#rect.height}px`;
  }

  #onAutoResize = (entry: ResizeObserverEntry) => {
    this.#previousRect.height = this.#rect.height;
    this.#rect.height = entry.contentRect.height;
    this.#previousRect.width = this.#rect.width;
    this.#rect.width = entry.contentRect.width;
    this.#dispatchTransformEvent();
  };

  #updateCursors() {
    const degrees = (this.#rect.rotation * 180) / Math.PI;

    const resizeCursor0 = getResizeCursorUrl(degrees);
    const resizeCursor90 = getResizeCursorUrl((degrees + 90) % 360);
    const rotateCursor0 = getRotateCursorUrl(degrees);
    const rotateCursor90 = getRotateCursorUrl((degrees + 90) % 360);
    const rotateCursor180 = getRotateCursorUrl((degrees + 180) % 360);
    const rotateCursor270 = getRotateCursorUrl((degrees + 270) % 360);

    // TODO use css variables
    const dynamicStyles = `
      [part='resize-top-left'],
      [part='resize-bottom-right'] {
        cursor: ${resizeCursor0};
      }

      [part='resize-top-right'],
      [part='resize-bottom-left'] {
        cursor: ${resizeCursor90};
      }

      [part='rotation-top-left'] {
        cursor: ${rotateCursor0};
      }

      [part='rotation-top-right'] {
        cursor: ${rotateCursor90};
      }

      [part='rotation-bottom-right'] {
        cursor: ${rotateCursor180};
      }

      [part='rotation-bottom-left'] {
        cursor: ${rotateCursor270};
      }
    `;

    this.#dynamicStyles.replaceSync(dynamicStyles);
  }

  #handleResize(handle: ResizeHandle, pointerPos: Point, target: HTMLElement, event?: PointerEvent) {
    const localPointer = this.#rect.toLocalSpace(pointerPos);

    switch (handle) {
      case 'resize-bottom-right':
        this.#rect.setBottomRight(localPointer);
        break;
      case 'resize-bottom-left':
        this.#rect.setBottomLeft(localPointer);
        break;
      case 'resize-top-left':
        this.#rect.setTopLeft(localPointer);
        break;
      case 'resize-top-right':
        this.#rect.setTopRight(localPointer);
        break;
    }

    let nextHandle: ResizeHandle = handle;

    const flipWidth = this.#rect.width < 0;
    const flipHeight = this.#rect.height < 0;

    if (flipWidth && flipHeight) {
      nextHandle = oppositeHandleMap[handle];
    } else if (flipWidth) {
      nextHandle = flipXHandleMap[handle];
    } else if (flipHeight) {
      nextHandle = flipYHandleMap[handle];
    }

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

    this.#requestUpdate();
  }
}
