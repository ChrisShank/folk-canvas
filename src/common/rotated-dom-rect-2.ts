import { Point } from './types';
import { Vector } from './Vector';

type RotatedDOMRectInit = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
};

/**
 * Represents a rectangle that can be rotated in 2D space.
 * All coordinates are relative to the center of the rectangle.
 */
interface IRotatedDOMRect {
  /** X coordinate of the rectangle's center */
  x: number;
  /** Y coordinate of the rectangle's center */
  y: number;
  /** Center point of the rectangle */
  center: Readonly<Point>;
  /** Width of the rectangle */
  width: number;
  /** Height of the rectangle */
  height: number;
  /** Rotation of the rectangle in radians */
  rotation: number;
  /** Top-left corner of the rotated rectangle */
  topLeft: Readonly<Point>;
  /** Top-right corner of the rotated rectangle */
  topRight: Readonly<Point>;
  /** Bottom-left corner of the rotated rectangle */
  bottomLeft: Readonly<Point>;
  /** Bottom-right corner of the rotated rectangle */
  bottomRight: Readonly<Point>;
  /**
   * Returns an axis-aligned bounding box that contains the rotated rectangle
   * @returns A DOMRectInit object representing the bounds
   */
  getBounds(): Required<DOMRectInit>;

  /** Mutate multiple properties at once efficiently */
  update(updates: Partial<RotatedDOMRectInit>): void;

  /** Create a new instance with modified properties */
  with(updates: Partial<RotatedDOMRectInit>): RotatedDOMRect;
}

export class RotatedDOMRect implements IRotatedDOMRect {
  private _center: Point = { x: 0, y: 0 };
  private _width: number = 0;
  private _height: number = 0;
  private _rotation: number = 0;

  // Cached derived values
  private _sinR: number | null = null;
  private _cosR: number | null = null;
  private _topLeftX: number | null = null;
  private _topLeftY: number | null = null;
  private _topRightX: number | null = null;
  private _topRightY: number | null = null;
  private _bottomLeftX: number | null = null;
  private _bottomLeftY: number | null = null;
  private _bottomRightX: number | null = null;
  private _bottomRightY: number | null = null;

  constructor({ x, y, width, height, rotation }: RotatedDOMRectInit = {}) {
    this._center = { x: x ?? 0, y: y ?? 0 };
    this._width = width ?? 0;
    this._height = height ?? 0;
    this._rotation = rotation ?? 0;
  }

  /* ——— Getters ——— */

  get center(): Readonly<Point> {
    return { ...this._center };
  }

  get x(): number {
    return this._center.x;
  }

  get y(): number {
    return this._center.y;
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  get rotation(): number {
    return this._rotation;
  }

  get topLeft(): Readonly<Point> {
    this.deriveValuesIfCacheInvalid();
    return { x: this._topLeftX!, y: this._topLeftY! };
  }

  get topRight(): Readonly<Point> {
    this.deriveValuesIfCacheInvalid();
    return { x: this._topRightX!, y: this._topRightY! };
  }

  get bottomLeft(): Readonly<Point> {
    this.deriveValuesIfCacheInvalid();
    return { x: this._bottomLeftX!, y: this._bottomLeftY! };
  }

  get bottomRight(): Readonly<Point> {
    this.deriveValuesIfCacheInvalid();
    return { x: this._bottomRightX!, y: this._bottomRightY! };
  }

  /* ——— Setters ——— */

  set center(point: Point) {
    this._center = point;
    this.invalidateCache();
  }

  set x(value: number) {
    this._center.x = value;
    this.invalidateCache();
  }

  set y(value: number) {
    this._center.y = value;
    this.invalidateCache();
  }

  set width(value: number) {
    this._width = value;
    this.invalidateCache();
  }

  set height(value: number) {
    this._height = value;
    this.invalidateCache();
  }

  set rotation(value: number) {
    this._rotation = value;
    this.invalidateCache();
  }

  set topLeft(point: Point) {
    this.moveCorner(point, this.bottomRight);
  }

  set topRight(point: Point) {
    this.moveCorner(point, this.bottomLeft);
  }

  set bottomLeft(point: Point) {
    this.moveCorner(point, this.topRight);
  }

  set bottomRight(point: Point) {
    this.moveCorner(point, this.topLeft);
  }

  getBounds(): Required<DOMRectInit> {
    if (!this.isCacheValid()) {
      this.deriveValuesIfCacheInvalid();
    }

    const minX = Math.min(this._topLeftX!, this._topRightX!, this._bottomLeftX!, this._bottomRightX!);
    const maxX = Math.max(this._topLeftX!, this._topRightX!, this._bottomLeftX!, this._bottomRightX!);
    const minY = Math.min(this._topLeftY!, this._topRightY!, this._bottomLeftY!, this._bottomRightY!);
    const maxY = Math.max(this._topLeftY!, this._topRightY!, this._bottomLeftY!, this._bottomRightY!);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /** Mutate multiple properties at once efficiently */
  update(updates: Partial<RotatedDOMRectInit>) {
    if (updates.x !== undefined) this._center.x = updates.x;
    if (updates.y !== undefined) this._center.y = updates.y;
    if (updates.width !== undefined) this._width = updates.width;
    if (updates.height !== undefined) this._height = updates.height;
    if (updates.rotation !== undefined) this._rotation = updates.rotation;
    this.invalidateCache();
  }

  /** Create a new instance with modified properties */
  with(updates: Partial<RotatedDOMRectInit>): RotatedDOMRect {
    return new RotatedDOMRect({
      x: updates.x ?? this._center.x,
      y: updates.y ?? this._center.y,
      width: updates.width ?? this._width,
      height: updates.height ?? this._height,
      rotation: updates.rotation ?? this._rotation,
    });
  }

  /* ——— Private methods ——— */

  private moveCorner(newCorner: Point, oppositeCorner: Point) {
    // Calculate new center as midpoint between corners
    this._center = {
      x: (newCorner.x + oppositeCorner.x) / 2,
      y: (newCorner.y + oppositeCorner.y) / 2,
    };

    // Get vector from center to new corner
    const cornerVector = {
      x: newCorner.x - this._center.x,
      y: newCorner.y - this._center.y,
    };

    // Un-rotate the corner vector by the current rotation
    const unrotatedX = cornerVector.x * Math.cos(-this._rotation) - cornerVector.y * Math.sin(-this._rotation);
    const unrotatedY = cornerVector.x * Math.sin(-this._rotation) + cornerVector.y * Math.cos(-this._rotation);

    // The width and height are twice the unrotated vector components
    this._width = unrotatedX * 2;
    this._height = unrotatedY * 2;

    this.invalidateCache();
  }

  private getTrigValues(): { sin: number; cos: number } {
    if (this._sinR === null || this._cosR === null) {
      this._sinR = Math.sin(this._rotation);
      this._cosR = Math.cos(this._rotation);
    }
    return { sin: this._sinR, cos: this._cosR };
  }

  private deriveValuesIfCacheInvalid() {
    if (this.isCacheValid()) return;

    const halfWidth = this._width / 2;
    const halfHeight = this._height / 2;
    const { sin, cos } = this.getTrigValues();

    this._topLeftX = this._center.x - halfWidth * cos + halfHeight * sin;
    this._topLeftY = this._center.y - halfWidth * sin - halfHeight * cos;

    this._topRightX = this._center.x + halfWidth * cos + halfHeight * sin;
    this._topRightY = this._center.y + halfWidth * sin - halfHeight * cos;

    this._bottomLeftX = this._center.x - halfWidth * cos - halfHeight * sin;
    this._bottomLeftY = this._center.y - halfWidth * sin + halfHeight * cos;

    this._bottomRightX = this._center.x + halfWidth * cos - halfHeight * sin;
    this._bottomRightY = this._center.y + halfWidth * sin + halfHeight * cos;
  }

  private invalidateCache() {
    this._sinR = null;
    this._cosR = null;
    this._topLeftX = null;
    this._topLeftY = null;
    this._topRightX = null;
    this._topRightY = null;
    this._bottomLeftX = null;
    this._bottomLeftY = null;
    this._bottomRightX = null;
    this._bottomRightY = null;
  }

  /**
   * Checks if the cached corner coordinates are valid.
   * Type assertion is safe because invalidateCache() clears all values atomically,
   * and calculateCorners() sets all values atomically.
   */
  private isCacheValid(): this is {
    _topLeftX: number;
    _topLeftY: number;
    _topRightX: number;
    _topRightY: number;
    _bottomLeftX: number;
    _bottomLeftY: number;
    _bottomRightX: number;
    _bottomRightY: number;
    _sinR: number;
    _cosR: number;
  } {
    return this._topLeftX !== null;
  }
}
