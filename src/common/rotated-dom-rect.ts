import { Point } from './types';
import { Vector } from './Vector';

interface RotatedDOMRectInit {
  height?: number;
  width?: number;
  x?: number;
  y?: number;
  rotation?: number;
}

export class RotatedDOMRect implements DOMRect {
  #other: RotatedDOMRectInit;

  constructor(other: RotatedDOMRectInit = {}) {
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

  #topLeftCorner: Point | null = null;
  get topLeftCorner() {
    if (this.#topLeftCorner === null) {
      this.#topLeftCorner = Vector.rotateAround({ x: this.x, y: this.y }, this.center, this.rotation);
    }
    return this.#topLeftCorner;
  }

  #topRightCorner: Point | null = null;
  get topRightCorner() {
    if (this.#topRightCorner === null) {
      this.#topRightCorner = Vector.rotateAround({ x: this.right, y: this.y }, this.center, this.rotation);
    }
    return this.#topRightCorner;
  }

  #bottomRightCorner: Point | null = null;
  get bottomRightCorner() {
    if (this.#bottomRightCorner === null) {
      this.#bottomRightCorner = Vector.rotateAround({ x: this.right, y: this.bottom }, this.center, this.rotation);
    }
    return this.#bottomRightCorner;
  }

  #bottomLeftCorner: Point | null = null;
  get bottomLeftCorner() {
    if (this.#bottomLeftCorner === null) {
      this.#bottomLeftCorner = Vector.rotateAround({ x: this.x, y: this.bottom }, this.center, this.rotation);
    }
    return this.#bottomLeftCorner;
  }

  #reset() {
    this.#center = null;
    this.#topLeftCorner = null;
    this.#topRightCorner = null;
    this.#bottomLeftCorner = null;
    this.#bottomRightCorner = null;
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
export class RotatedDOMRectReadonly extends RotatedDOMRect {
  #other: RotatedDOMRectInit;

  constructor(other: RotatedDOMRectInit = {}) {
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
