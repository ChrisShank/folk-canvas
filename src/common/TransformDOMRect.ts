import { Point } from './types';
import { Vector } from './Vector';

interface TransformDOMRectInit {
  height?: number;
  width?: number;
  x?: number;
  y?: number;
  rotation?: number;
}

export class TransformDOMRect implements DOMRect {
  #other: TransformDOMRectInit;

  constructor(other: TransformDOMRectInit = {}) {
    this.#other = other;
  }

  get x(): number {
    return this.#other.x ?? 0;
  }
  set x(x: number) {
    this.#other.x = x;
    this.#reset();
  }

  get y(): number {
    return this.#other.y ?? 0;
  }
  set y(y: number) {
    this.#other.y = y;
    this.#reset();
  }

  get height(): number {
    return this.#other.height ?? 0;
  }
  set height(height: number) {
    this.#other.height = height;
    this.#reset();
  }

  get width(): number {
    return this.#other.width ?? 0;
  }
  set width(width: number) {
    this.#other.width = width;
    this.#reset();
  }

  get rotation(): number {
    return this.#other.rotation ?? 0;
  }
  set rotation(rotation: number) {
    this.#other.rotation = rotation;
    this.#reset();
  }

  get left(): number {
    return this.x;
  }

  get top(): number {
    return this.y;
  }

  get right(): number {
    return this.x + this.width;
  }

  get bottom(): number {
    return this.y + this.height;
  }

  #center: Point | null = null;
  /** Returns the center point in worldspace coordinates */
  get center(): Point {
    if (this.#center === null) {
      this.#center = {
        x: this.x + this.width / 2,
        y: this.y + this.height / 2,
      };
    }
    return this.#center;
  }

  #topLeft: Point | null = null;
  get topLeft() {
    if (this.#topLeft === null) {
      this.#topLeft = Vector.rotateAround({ x: this.x, y: this.y }, this.center, this.rotation);
    }
    return this.#topLeft;
  }

  #topRight: Point | null = null;
  get topRight() {
    if (this.#topRight === null) {
      this.#topRight = Vector.rotateAround({ x: this.right, y: this.y }, this.center, this.rotation);
    }
    return this.#topRight;
  }

  #bottomRight: Point | null = null;
  get bottomRight() {
    if (this.#bottomRight === null) {
      this.#bottomRight = Vector.rotateAround({ x: this.right, y: this.bottom }, this.center, this.rotation);
    }
    return this.#bottomRight;
  }

  #bottomLeft: Point | null = null;
  get bottomLeft() {
    if (this.#bottomLeft === null) {
      this.#bottomLeft = Vector.rotateAround({ x: this.x, y: this.bottom }, this.center, this.rotation);
    }
    return this.#bottomLeft;
  }

  #reset() {
    this.#center = null;
    this.#topLeft = null;
    this.#topRight = null;
    this.#bottomLeft = null;
    this.#bottomRight = null;
  }

  /** Returns all the vertices in worldspace coordinates */
  vertices(): Point[] {
    return [];
  }

  toJSON() {
    return {};
  }
}

// We cant just override the setter, we need to override the getter and setter.
export class TransformDOMRectReadonly extends TransformDOMRect {
  #other: TransformDOMRectInit;

  constructor(other: TransformDOMRectInit = {}) {
    super(other);
    this.#other = other;
  }

  get x(): number {
    return this.#other.x ?? 0;
  }
  set x(x: number) {}

  get y(): number {
    return this.#other.y ?? 0;
  }
  set y(y: number) {}

  get height(): number {
    return this.#other.height ?? 0;
  }
  set height(height: number) {}

  get width(): number {
    return this.#other.width ?? 0;
  }
  set width(width: number) {}

  get rotation(): number {
    return this.#other.rotation ?? 0;
  }
  set rotation(rotation: number) {}
}
