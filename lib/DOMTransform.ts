import { Matrix } from './Matrix';
import { Point } from './types';

interface DOMTransformInit {
  x?: number;
  y?: number;
  rotation?: number;
}

/**
 * Represents a 2D transform with position and rotation,
 * capable of transforming points between local and parent coordinate spaces.
 */
export class DOMTransform {
  // Private properties for position and rotation
  #x: number;
  #y: number;
  #rotation: number;

  // Internal transformation matrices
  #transformMatrix: Matrix;
  #inverseMatrix: Matrix;

  constructor(init: DOMTransformInit = {}) {
    this.#x = init.x ?? 0;
    this.#y = init.y ?? 0;
    this.#rotation = init.rotation ?? 0;

    // Initialize transformation matrices
    this.#transformMatrix = Matrix.Identity();
    this.#inverseMatrix = Matrix.Identity();

    this.#updateMatrices();
  }

  // Getters and setters for properties

  get x(): number {
    return this.#x;
  }
  set x(value: number) {
    this.#x = value;
    this.#updateMatrices();
  }

  get y(): number {
    return this.#y;
  }
  set y(value: number) {
    this.#y = value;
    this.#updateMatrices();
  }

  get rotation(): number {
    return this.#rotation;
  }
  set rotation(value: number) {
    this.#rotation = value;
    this.#updateMatrices();
  }

  /**
   * Updates the transformation matrices based on the current position and rotation.
   */
  #updateMatrices() {
    this.#transformMatrix.identity().translate(this.#x, this.#y).rotate(this.#rotation);

    this.#inverseMatrix = this.#transformMatrix.clone().invert();
  }

  // Matrix accessors
  get matrix(): Matrix {
    return this.#transformMatrix;
  }
  get inverse(): Matrix {
    return this.#inverseMatrix;
  }

  /**
   * Converts a point from **parent space** to **local space**.
   */
  toPoint(point: Point): Point {
    return this.#inverseMatrix.applyToPoint(point);
  }

  /**
   * Converts a point from **local space** to **parent space**.
   */
  toInversePoint(point: Point): Point {
    return this.#transformMatrix.applyToPoint(point);
  }

  /**
   * Generates a CSS transform string representing the transformation.
   */
  toCssString(): string {
    return this.#transformMatrix.toCssString();
  }

  /**
   * Converts the transform's properties to a JSON serializable object.
   */
  toJSON() {
    return {
      x: this.x,
      y: this.y,
      rotation: this.rotation,
    };
  }
}
