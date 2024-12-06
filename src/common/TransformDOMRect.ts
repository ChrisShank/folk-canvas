import { Point } from './types';
import { Matrix } from './Matrix';

interface TransformDOMRectInit {
  height?: number;
  width?: number;
  x?: number;
  y?: number;
  rotation?: number;
}

export class TransformDOMRect implements DOMRect {
  // Private properties
  private _x: number;
  private _y: number;
  private _width: number;
  private _height: number;
  private _rotation: number;

  // Internal matrices
  #transformMatrix: Matrix;
  #inverseMatrix: Matrix;

  constructor(init: TransformDOMRectInit = {}) {
    this._x = init.x ?? 0;
    this._y = init.y ?? 0;
    this._width = init.width ?? 0;
    this._height = init.height ?? 0;
    this._rotation = init.rotation ?? 0;

    // Initialize matrices
    this.#transformMatrix = Matrix.Identity();
    this.#inverseMatrix = Matrix.Identity();

    this.#updateMatrices();
  }

  // Getters and setters for properties
  get x(): number {
    return this._x;
  }
  set x(value: number) {
    this._x = value;
    this.#updateMatrices();
  }

  get y(): number {
    return this._y;
  }
  set y(value: number) {
    this._y = value;
    this.#updateMatrices();
  }

  get width(): number {
    return this._width;
  }
  set width(value: number) {
    this._width = value;
    this.#updateMatrices();
  }

  get height(): number {
    return this._height;
  }
  set height(value: number) {
    this._height = value;
    this.#updateMatrices();
  }

  get rotation(): number {
    return this._rotation;
  }
  set rotation(value: number) {
    this._rotation = value;
    this.#updateMatrices();
  }

  // DOMRect read-only properties
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

  // Updates the transformation matrices using instance functions
  #updateMatrices() {
    // Reset the transformMatrix to identity
    this.#transformMatrix.identity();

    // Compute the center point
    const centerX = this._x + this._width / 2;
    const centerY = this._y + this._height / 2;

    // Apply transformations: translate to center, rotate, translate back
    this.#transformMatrix.translate(centerX, centerY);
    this.#transformMatrix.rotate(this._rotation);
    this.#transformMatrix.translate(-this._width / 2, -this._height / 2);

    // Update inverseMatrix as the inverse of transformMatrix
    this.#inverseMatrix = this.#transformMatrix.clone().invert();
  }

  // Accessors for the transformation matrices
  get transformMatrix(): Matrix {
    return this.#transformMatrix;
  }

  get inverseMatrix(): Matrix {
    return this.#inverseMatrix;
  }

  // Converts a point from parent space to local space
  toLocalSpace(point: Point): Point {
    return this.#inverseMatrix.applyToPoint(point);
  }

  // Converts a point from local space to parent space
  toParentSpace(point: Point): Point {
    return this.#transformMatrix.applyToPoint(point);
  }

  // Local space corners
  get topLeft(): Point {
    return { x: 0, y: 0 };
  }

  get topRight(): Point {
    return { x: this.width, y: 0 };
  }

  get bottomRight(): Point {
    return { x: this.width, y: this.height };
  }

  get bottomLeft(): Point {
    return { x: 0, y: this.height };
  }

  get center(): Point {
    return {
      x: this.x + this.width / 2,
      y: this.y + this.height / 2,
    };
  }

  vertices(): Point[] {
    return [this.topLeft, this.topRight, this.bottomRight, this.bottomLeft];
  }

  toCssString(): string {
    return this.transformMatrix.toCssString();
  }

  toJSON() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      rotation: this.rotation,
    };
  }

  setTopLeft(point: Point) {
    const oldBottomRight = this.bottomRight;
    this._width = oldBottomRight.x - point.x;
    this._height = oldBottomRight.y - point.y;
    this._x = point.x;
    this._y = point.y;
    this.#updateMatrices();
  }

  setTopRight(point: Point) {
    const oldBottomLeft = this.bottomLeft;
    this._width = point.x;
    this._height = oldBottomLeft.y - point.y;
    this._y = point.y;
    this.#updateMatrices();
  }

  setBottomRight(point: Point) {
    this._width = point.x;
    this._height = point.y;
    this.#updateMatrices();
  }

  setBottomLeft(point: Point) {
    const oldTopRight = this.topRight;
    this._width = oldTopRight.x - point.x;
    this._height = point.y;
    this._x = point.x;
    this.#updateMatrices();
  }
}

// Read-only version of TransformDOMRect
export class TransformDOMRectReadonly extends TransformDOMRect {
  constructor(init: TransformDOMRectInit = {}) {
    super(init);
  }

  // Override setters to prevent modification
  set x(value: number) {
    throw new Error('Cannot modify readonly TransformDOMRect');
  }

  set y(value: number) {
    throw new Error('Cannot modify readonly TransformDOMRect');
  }

  set width(value: number) {
    throw new Error('Cannot modify readonly TransformDOMRect');
  }

  set height(value: number) {
    throw new Error('Cannot modify readonly TransformDOMRect');
  }

  set rotation(value: number) {
    throw new Error('Cannot modify readonly TransformDOMRect');
  }
}
