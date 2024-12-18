import { css, html } from '@lib/tags';
import { ResizeObserverManager } from '@lib/resize-observer';
import { Point } from '@lib/types';
import { DOMRectTransform, DOMRectTransformReadonly } from '@lib/DOMRectTransform';
import { Vector } from '@lib/Vector';
import { getResizeCursorUrl, getRotateCursorUrl } from '@labs/utils/cursors';
import { TransformEvent } from '@lib/TransformEvent';

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
  * {
    box-sizing: border-box;
  }

  :host {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    cursor: move;
    transform-origin: 0 0;
    box-sizing: border-box;
  }

  :host::before {
    content: '';
    position: absolute;
    inset: -15px;
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

  :host(:hover),
  :host(:state(highlighted)) {
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

  [part] {
    aspect-ratio: 1;
    display: none;
    position: absolute;
    z-index: calc(infinity);
    padding: 0;
  }

  [part^='resize'] {
    background: hsl(210, 20%, 98%);
    width: 9px;
    transform: translate(-50%, -50%);
    border: 1.5px solid hsl(214, 84%, 56%);
    border-radius: 2px;

    @media (any-pointer: coarse) {
      width: 13px;
    }
  }

  [part^='rotation'] {
    opacity: 0;
    width: 16px;

    @media (any-pointer: coarse) {
      width: 20px;
    }
  }

  [part$='top-left'] {
    top: 0;
    left: 0;
  }

  [part='rotation-top-left'] {
    translate: -100% -100%;
  }

  [part$='top-right'] {
    top: 0;
    left: 100%;
  }

  [part='rotation-top-right'] {
    translate: 0% -100%;
  }

  [part$='bottom-right'] {
    top: 100%;
    left: 100%;
  }

  [part='rotation-bottom-right'] {
    translate: 0% 0%;
  }

  [part$='bottom-left'] {
    top: 100%;
    left: 0;
  }

  [part='rotation-bottom-left'] {
    translate: -100% 0%;
  }

  :host(:focus-within) :is([part^='resize'], [part^='rotation']) {
    display: block;
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

  #attrWidth: Dimension = 0;
  #attrHeight: Dimension = 0;

  #rect = new DOMRectTransform();
  #previousRect = new DOMRectTransform();
  #readonlyRect = new DOMRectTransformReadonly();

  #handles: Record<ResizeHandle | RotateHandle, HTMLElement>;

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
    } else {
      if (this.#attrWidth === 'auto' && this.#attrHeight !== 'auto') {
        resizeObserver.unobserve(this, this.#onAutoResize);
      }
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
    } else {
      if (this.#attrHeight === 'auto' && this.#attrWidth !== 'auto') {
        resizeObserver.unobserve(this, this.#onAutoResize);
      }
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

  #highlighted = false;
  get highlighted() {
    return this.#highlighted;
  }
  set highlighted(highlighted) {
    if (this.#highlighted === highlighted) return;

    this.#highlighted = highlighted;

    highlighted ? this.#internals.states.add('highlighted') : this.#internals.states.delete('highlighted');
  }

  constructor() {
    super();

    this.addEventListener('pointerdown', this);
    this.addEventListener('keydown', this);

    this.#shadow.adoptedStyleSheets.push(styles);
    // Ideally we would creating these lazily on first focus, but the resize handlers need to be around for delegate focus to work.
    // Maybe can add the first resize handler here, and lazily instantiate the rest when needed?
    // I can see it becoming important at scale
    this.#shadow.setHTMLUnsafe(html` <button part="rotation-top-left" tabindex="-1"></button>
      <button part="rotation-top-right" tabindex="-1"></button>
      <button part="rotation-bottom-right" tabindex="-1"></button>
      <button part="rotation-bottom-left" tabindex="-1"></button>
      <button part="resize-top-left" aria-label="Resize shape from top left"></button>
      <button part="resize-top-right" aria-label="Resize shape from top right"></button>
      <button part="resize-bottom-right" aria-label="Resize shape from bottom right"></button>
      <button part="resize-bottom-left" aria-label="Resize shape from bottom left"></button>
      <div><slot></slot></div>`);

    this.#handles = Object.fromEntries(
      Array.from(this.#shadow.querySelectorAll('[part]')).map((el) => [
        el.getAttribute('part') as ResizeHandle | RotateHandle,
        el as HTMLElement,
      ])
    ) as Record<ResizeHandle | RotateHandle, HTMLElement>;

    this.#updateCursors();

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

  // todo: rename to `getDOMRectTransform`
  getTransformDOMRect() {
    return this.#readonlyRect;
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
    const focusedElement = this.#shadow.activeElement as HTMLElement | null;
    const target = event.composedPath()[0] as HTMLElement;
    let handle: Handle | null = null;
    if (target) {
      handle = target.getAttribute('part') as Handle | null;
    } else if (focusedElement) {
      handle = focusedElement.getAttribute('part') as Handle | null;
    }

    // Handle pointer capture setup/cleanup
    if (event instanceof PointerEvent) {
      if (event.type === 'pointerdown') {
        if (target !== this && !handle) return;

        // Setup rotation initial state if needed
        if (handle?.startsWith('rotation')) {
          const parentRotateOrigin = this.#rect.toParentSpace({
            x: this.#rect.width * this.#rect.rotateOrigin.x,
            y: this.#rect.height * this.#rect.rotateOrigin.y,
          });
          // Calculate initial angle including current rotation
          const mousePos = { x: event.clientX, y: event.clientY };
          this.#startAngle = Vector.angleFromOrigin(mousePos, parentRotateOrigin) - this.#rect.rotation;
        }

        // Setup pointer capture
        target.addEventListener('pointermove', this);
        target.addEventListener('lostpointercapture', this);
        target.setPointerCapture(event.pointerId);
        this.#internals.states.add(handle || 'move');
        this.focus();
        return;
      }

      if (event.type === 'lostpointercapture') {
        this.#internals.states.delete(handle || 'move');
        target.removeEventListener('pointermove', this);
        target.removeEventListener('lostpointercapture', this);
        this.#updateCursors();
        if (handle?.startsWith('rotation')) {
          target.style.removeProperty('cursor');
        }
        return;
      }
    }

    // Calculate movement delta from either keyboard or pointer
    let moveDelta: Point | null = null;
    if (event instanceof KeyboardEvent) {
      const MOVEMENT_MUL = event.shiftKey ? 20 : 2;
      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (!arrowKeys.includes(event.key)) return;

      moveDelta = {
        x: (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0) * MOVEMENT_MUL,
        y: (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0) * MOVEMENT_MUL,
      };
    } else if (event.type === 'pointermove') {
      if (!target) return;
      const zoom = window.visualViewport?.scale ?? 1;
      moveDelta = {
        x: event.movementX / zoom,
        y: event.movementY / zoom,
      };
    }

    if (!moveDelta) return;

    // Handle shape movement and rotation
    if (target === this || (!handle && event instanceof KeyboardEvent)) {
      if (event instanceof KeyboardEvent && event.altKey) {
        const ROTATION_MUL = event.shiftKey ? Math.PI / 12 : Math.PI / 36;
        const rotationDelta = moveDelta.x !== 0 ? (moveDelta.x > 0 ? ROTATION_MUL : -ROTATION_MUL) : 0;
        this.rotation += rotationDelta;
      } else {
        this.x += moveDelta.x;
        this.y += moveDelta.y;
      }
      event.preventDefault();
      return;
    }

    // Handle resize
    if (handle?.startsWith('resize') || handle?.startsWith('resize')) {
      const rect = this.#rect;
      const corner = {
        'resize-top-left': rect.topLeft,
        'resize-top-right': rect.topRight,
        'resize-bottom-right': rect.bottomRight,
        'resize-bottom-left': rect.bottomLeft,
      }[handle as ResizeHandle];

      const currentPos = rect.toParentSpace(corner);
      const mousePos =
        event instanceof KeyboardEvent
          ? { x: currentPos.x + moveDelta.x, y: currentPos.y + moveDelta.y }
          : { x: event.clientX, y: event.clientY };

      this.#handleResize(handle as ResizeHandle, mousePos, target, event instanceof PointerEvent ? event : undefined);
      event.preventDefault();
      return;
    }

    // Handle pointer rotation
    if (handle?.startsWith('rotation') && event instanceof PointerEvent) {
      const parentRotateOrigin = this.#rect.toParentSpace({
        x: this.#rect.width * this.#rect.rotateOrigin.x,
        y: this.#rect.height * this.#rect.rotateOrigin.y,
      });
      const currentAngle = Vector.angleFromOrigin({ x: event.clientX, y: event.clientY }, parentRotateOrigin);
      // Apply rotation relative to start angle
      this.rotation = currentAngle - this.#startAngle;

      const degrees = (this.#rect.rotation * 180) / Math.PI;
      const cursorRotation = {
        'rotation-top-left': degrees,
        'rotation-top-right': (degrees + 90) % 360,
        'rotation-bottom-right': (degrees + 180) % 360,
        'rotation-bottom-left': (degrees + 270) % 360,
      }[handle as RotateHandle];

      target.style.setProperty('cursor', getRotateCursorUrl(cursorRotation));
      return;
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
    const emmittedRect = new DOMRectTransform(this.#rect);
    const event = new TransformEvent(emmittedRect, this.#previousRect);
    this.dispatchEvent(event);

    if (event.xPrevented) {
      emmittedRect.x = this.#previousRect.x;
    }
    if (event.yPrevented) {
      emmittedRect.y = this.#previousRect.y;
    }
    if (event.widthPrevented) {
      emmittedRect.width = this.#previousRect.width;
    }
    if (event.heightPrevented) {
      emmittedRect.height = this.#previousRect.height;
    }
    if (event.rotatePrevented) {
      emmittedRect.rotation = this.#previousRect.rotation;
    }

    this.style.transform = emmittedRect.toCssString();
    this.style.width = this.#attrWidth === 'auto' ? '' : `${emmittedRect.width}px`;
    this.style.height = this.#attrHeight === 'auto' ? '' : `${emmittedRect.height}px`;

    this.#readonlyRect = new DOMRectTransformReadonly(emmittedRect);
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

    this.#handles['resize-top-left'].style.setProperty('cursor', resizeCursor0);
    this.#handles['resize-bottom-right'].style.setProperty('cursor', resizeCursor0);
    this.#handles['resize-top-right'].style.setProperty('cursor', resizeCursor90);
    this.#handles['resize-bottom-left'].style.setProperty('cursor', resizeCursor90);

    this.#handles['rotation-top-left'].style.setProperty('cursor', getRotateCursorUrl(degrees));
    this.#handles['rotation-top-right'].style.setProperty('cursor', getRotateCursorUrl((degrees + 90) % 360));
    this.#handles['rotation-bottom-right'].style.setProperty('cursor', getRotateCursorUrl((degrees + 180) % 360));
    this.#handles['rotation-bottom-left'].style.setProperty('cursor', getRotateCursorUrl((degrees + 270) % 360));
  }

  #handleResize(handle: ResizeHandle, pointerPos: Point, target: HTMLElement, event?: PointerEvent) {
    const localPointer = this.#rect.toLocalSpace(pointerPos);

    switch (handle) {
      case 'resize-bottom-right':
        this.#rect.bottomRight = localPointer;
        break;
      case 'resize-bottom-left':
        this.#rect.bottomLeft = localPointer;
        break;
      case 'resize-top-left':
        this.#rect.topLeft = localPointer;
        break;
      case 'resize-top-right':
        this.#rect.topRight = localPointer;
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
