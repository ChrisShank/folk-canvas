import type { DOMRectTransformReadonly } from './DOMRectTransform';

// TODO: expose previous and current rects
export class TransformEvent extends Event {
  readonly #current: DOMRectTransformReadonly;
  readonly #previous: DOMRectTransformReadonly;

  constructor(current: DOMRectTransformReadonly, previous?: DOMRectTransformReadonly) {
    super('transform', { cancelable: true, bubbles: true });
    this.#current = current;
    this.#previous = previous ?? current;
  }

  get current() {
    return this.#current;
  }

  get previous() {
    return this.#previous;
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
