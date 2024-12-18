import type { Point } from './types.ts';

const { hypot, cos, sin, atan2 } = Math;

export class Vector {
  /**
   * Creates a zero vector (0,0)
   * @returns {Point} A point representing a zero vector
   */
  static zero(): Point {
    return { x: 0, y: 0 };
  }

  /**
   * Subtracts vector b from vector a
   * @param {Point} a - The first vector
   * @param {Point} b - The vector to subtract
   * @returns {Point} The resulting vector
   */
  static sub(a: Point, b: Point): Point {
    return { x: a.x - b.x, y: a.y - b.y };
  }

  /**
   * Adds two vectors together
   * @param {Point} a - The first vector
   * @param {Point} b - The second vector
   * @returns {Point} The sum of the two vectors
   */
  static add(a: Point, b: Point): Point {
    return { x: a.x + b.x, y: a.y + b.y };
  }

  /**
   * Multiplies two vectors component-wise
   * @param {Point} a - The first vector
   * @param {Point} b - The second vector
   * @returns {Point} The component-wise product of the two vectors
   */
  static mult(a: Point, b: Point): Point {
    return { x: a.x * b.x, y: a.y * b.y };
  }

  /**
   * Scales a vector by a scalar value
   * @param {Point} v - The vector to scale
   * @param {number} scaleFactor - The scaling factor
   * @returns {Point} The scaled vector
   */
  static scale(v: Point, scaleFactor: number): Point {
    return { x: v.x * scaleFactor, y: v.y * scaleFactor };
  }

  /**
   * Calculates the magnitude (length) of a vector
   * @param {Point} v - The vector
   * @returns {number} The magnitude of the vector
   */
  static mag(v: Point): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  /**
   * Returns a normalized (unit) vector in the same direction
   * @param {Point} v - The vector to normalize
   * @returns {Point} The normalized vector
   */
  static normalized(v: Point): Point {
    const { x, y } = v;
    const magnitude = hypot(x, y);
    if (magnitude === 0) return { x: 0, y: 0 };
    const invMag = 1 / magnitude;
    return { x: x * invMag, y: y * invMag };
  }

  /**
   * Calculates the Euclidean distance between two points
   * @param {Point} a - The first point
   * @param {Point} b - The second point
   * @returns {number} The distance between the points
   */
  static distance(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculates the squared distance between two points
   * Useful for performance when comparing distances
   * @param {Point} a - The first point
   * @param {Point} b - The second point
   * @returns {number} The squared distance between the points
   */
  static distanceSquared(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  /**
   * Linearly interpolates between two points
   * @param {Point} a - The starting point
   * @param {Point} b - The ending point
   * @param {number} t - The interpolation parameter (0-1)
   * @returns {Point} The interpolated point
   */
  static lerp(a: Point, b: Point, t: number): Point {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    };
  }

  /**
   * Rotates a vector by a given angle (in radians)
   * @param {Point} v - The vector to rotate
   * @param {number} angle - The angle in radians
   * @returns {Point} The rotated vector
   */
  static rotate(v: Point, angle: number): Point {
    const _cos = cos(angle);
    const _sin = sin(angle);
    return {
      x: v.x * _cos - v.y * _sin,
      y: v.x * _sin + v.y * _cos,
    };
  }

  /**
   * Rotates a point around a pivot point by a given angle (in radians)
   * @param {Point} point - The point to rotate
   * @param {Point} pivot - The point to rotate around
   * @param {number} angle - The angle in radians
   * @returns {Point} The rotated point
   */
  static rotateAround(point: Point, pivot: Point, angle: number): Point {
    const dx = point.x - pivot.x;
    const dy = point.y - pivot.y;
    const c = cos(angle);
    const s = sin(angle);
    return {
      x: pivot.x + dx * c - dy * s,
      y: pivot.y + dx * s + dy * c,
    };
  }

  /**
   * Calculates the angle (in radians) between the vector and the positive x-axis
   * @param {Point} v - The vector
   * @returns {number} The angle in radians
   */
  static angle(v: Point): number {
    return atan2(v.y, v.x);
  }

  /**
   * Calculates the angle (in radians) between two vectors
   * @param {Point} a - The first vector
   * @param {Point} b - The second vector (optional, defaults to positive x-axis unit vector)
   * @returns {number} The angle in radians
   */
  static angleTo(a: Point, b: Point = { x: 1, y: 0 }): number {
    // Get the angle of each vector relative to x-axis
    const angleA = Vector.angle(a);
    const angleB = Vector.angle(b);

    // Return the difference
    return angleA - angleB;
  }

  /**
   * Calculates the angle between a point and a center point relative to the positive x-axis
   * @param {Point} point - The point to measure from
   * @param {Point} origin - The origin point to measure around
   * @returns {number} The angle in radians
   */
  static angleFromOrigin(point: Point, origin: Point): number {
    return Vector.angleTo({
      x: point.x - origin.x,
      y: point.y - origin.y,
    });
  }

  /**
   * Calculates the squared magnitude of a vector
   * @param {Point} v - The vector
   * @returns {number} The squared magnitude of the vector
   */
  static magSquared(v: Point): number {
    return v.x * v.x + v.y * v.y;
  }
}
