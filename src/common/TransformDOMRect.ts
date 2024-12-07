import { Point } from './types';
import { Matrix } from './Matrix';

interface TransformDOMRectInit {
  height?: number;
  width?: number;
  x?: number;
  y?: number;
  rotation?: number;
  transformOrigin?: Point;
  rotateOrigin?: Point;
}

/**
 * Represents a rectangle with position, size, and rotation,
 * capable of transforming points between local and parent coordinate spaces.
 *
 * **Coordinate System:**
 * - The origin `(0, 0)` is at the **top-left corner**.
 * - Positive `x` values extend **to the right**.
 * - Positive `y` values extend **downward**.
 * - Rotation is **clockwise**, in **radians**, around the rectangle's **center**.
 */
export class TransformDOMRect implements DOMRect {
  // Private properties for position, size, rotation, and origins
  private _x: number; // X-coordinate of the top-left corner
  private _y: number; // Y-coordinate of the top-left corner
  private _width: number; // Width of the rectangle
  private _height: number; // Height of the rectangle
  private _rotation: number; // Rotation angle in radians, clockwise

  // New properties for transform origin and rotation origin
  private _transformOrigin: Point; // Origin for transformations
  private _rotateOrigin: Point; // Origin for rotation

  // Internal transformation matrices
  #transformMatrix: Matrix; // Transforms from local to parent space
  #inverseMatrix: Matrix; // Transforms from parent to local space

  /**
   * Constructs a new `TransformDOMRect`.
   * @param init - Optional initial values.
   */
  constructor(init: TransformDOMRectInit = {}) {
    this._x = init.x ?? 0;
    this._y = init.y ?? 0;
    this._width = init.width ?? 0;
    this._height = init.height ?? 0;
    this._rotation = init.rotation ?? 0;

    // Initialize origins with relative values (0.5, 0.5 is center)
    this._transformOrigin = init.transformOrigin ?? { x: 0.5, y: 0.5 };
    this._rotateOrigin = init.rotateOrigin ?? { x: 0.5, y: 0.5 };

    // Initialize transformation matrices
    this.#transformMatrix = Matrix.Identity();
    this.#inverseMatrix = Matrix.Identity();

    this.#updateMatrices();
  }

  // Getters and setters for properties

  /** Gets or sets the **x-coordinate** of the top-left corner. */
  get x(): number {
    return this._x;
  }
  set x(value: number) {
    this._x = value;
    this.#updateMatrices();
  }

  /** Gets or sets the **y-coordinate** of the top-left corner. */
  get y(): number {
    return this._y;
  }
  set y(value: number) {
    this._y = value;
    this.#updateMatrices();
  }

  /** Gets or sets the **width** of the rectangle. */
  get width(): number {
    return this._width;
  }
  set width(value: number) {
    this._width = value;
    this.#updateMatrices();
  }

  /** Gets or sets the **height** of the rectangle. */
  get height(): number {
    return this._height;
  }
  set height(value: number) {
    this._height = value;
    this.#updateMatrices();
  }

  /** Gets or sets the **rotation angle** in radians, **clockwise**. */
  get rotation(): number {
    return this._rotation;
  }
  set rotation(value: number) {
    this._rotation = value;
    this.#updateMatrices();
  }

  /** Gets or sets the **transform origin** as relative values (0 to 1). */
  get transformOrigin(): Point {
    return this._transformOrigin;
  }
  set transformOrigin(value: Point) {
    this._transformOrigin = value;
    this.#updateMatrices();
  }

  /** Gets or sets the **rotation origin** as relative values (0 to 1). */
  get rotateOrigin(): Point {
    return this._rotateOrigin;
  }
  set rotateOrigin(value: Point) {
    this._rotateOrigin = value;
    this.#updateMatrices();
  }

  // DOMRect read-only properties

  /** The **left** coordinate of the rectangle (same as `x`). */
  get left(): number {
    return this.x;
  }

  /** The **top** coordinate of the rectangle (same as `y`). */
  get top(): number {
    return this.y;
  }

  /** The **right** coordinate of the rectangle (`x + width`). */
  get right(): number {
    return this.x + this.width;
  }

  /** The **bottom** coordinate of the rectangle (`y + height`). */
  get bottom(): number {
    return this.y + this.height;
  }

  /**
   * Updates the transformation matrices based on the current position,
   * size, rotation, and origins of the rectangle.
   *
   * The transformation sequence is:
   * 1. **Translate** to the global position.
   * 2. **Translate** to the transform origin.
   * 3. **Rotate** around the rotation origin.
   * 4. **Translate** back from the transform origin.
   */
  #updateMatrices() {
    // Reset the transformMatrix to identity
    this.#transformMatrix.identity();

    // Get absolute positions for origins
    const transformOrigin = this.#getAbsoluteTransformOrigin();
    const rotateOrigin = this.#getAbsoluteRotateOrigin();

    // Apply transformations
    this.#transformMatrix
      // Step 1: Translate to global position
      .translate(this._x, this._y)
      // Step 2: Translate to the transform origin
      .translate(transformOrigin.x, transformOrigin.y)
      // Step 3: Rotate around the rotation origin
      .translate(rotateOrigin.x - transformOrigin.x, rotateOrigin.y - transformOrigin.y)
      .rotate(this._rotation)
      .translate(-(rotateOrigin.x - transformOrigin.x), -(rotateOrigin.y - transformOrigin.y))
      // Step 4: Translate back from the transform origin
      .translate(-transformOrigin.x, -transformOrigin.y);

    // Update inverseMatrix as the inverse of transformMatrix
    this.#inverseMatrix = this.#transformMatrix.clone().invert();
  }

  // Convert relative origins to absolute points
  #getAbsoluteTransformOrigin(): Point {
    return {
      x: this._width * this._transformOrigin.x,
      y: this._height * this._transformOrigin.y,
    };
  }

  #getAbsoluteRotateOrigin(): Point {
    return {
      x: this._width * this._rotateOrigin.x,
      y: this._height * this._rotateOrigin.y,
    };
  }

  // Accessors for the transformation matrices
  get transformMatrix(): Matrix {
    return this.#transformMatrix;
  }

  get inverseMatrix(): Matrix {
    return this.#inverseMatrix;
  }

  /**
   * Converts a point from **parent space** to **local space**.
   * @param point - The point in parent coordinate space.
   * @returns The point in local coordinate space.
   */
  toLocalSpace(point: Point): Point {
    return this.#inverseMatrix.applyToPoint(point);
  }

  /**
   * Converts a point from **local space** to **parent space**.
   * @param point - The point in local coordinate space.
   * @returns The point in parent coordinate space.
   */
  toParentSpace(point: Point): Point {
    return this.#transformMatrix.applyToPoint(point);
  }

  // Local space corners

  /**
   * Gets the **top-left** corner of the rectangle in **local space** (before transformation).
   */
  get topLeft(): Point {
    return { x: 0, y: 0 };
  }

  /**
   * Gets the **top-right** corner of the rectangle in **local space** (before transformation).
   */
  get topRight(): Point {
    return { x: this.width, y: 0 };
  }

  /**
   * Gets the **bottom-right** corner of the rectangle in **local space** (before transformation).
   */
  get bottomRight(): Point {
    return { x: this.width, y: this.height };
  }

  /**
   * Gets the **bottom-left** corner of the rectangle in **local space** (before transformation).
   */
  get bottomLeft(): Point {
    return { x: 0, y: this.height };
  }

  /**
   * Gets the **center point** of the rectangle in **parent space**.
   */
  get center(): Point {
    return {
      x: this.x + this.width / 2,
      y: this.y + this.height / 2,
    };
  }

  /**
   * Gets the four corner vertices of the rectangle in **local space**.
   * @returns An array of points in the order: top-left, top-right, bottom-right, bottom-left.
   */
  vertices(): Point[] {
    return [this.topLeft, this.topRight, this.bottomRight, this.bottomLeft];
  }

  /**
   * Generates a CSS transform string representing the rectangle's transformation.
   * @returns A string suitable for use in CSS `transform` properties.
   */
  toCssString(): string {
    return this.transformMatrix.toCssString();
  }

  /**
   * Converts the rectangle's properties to a JSON serializable object.
   * @returns An object containing the rectangle's `x`, `y`, `width`, `height`, and `rotation`.
   */
  toJSON() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      rotation: this.rotation,
    };
  }

  /**
   * Sets the **top-left** corner of the rectangle in **local space**, adjusting the position, width, and height accordingly,
   * and keeps the **bottom-right corner** fixed in the **parent space**.
   * @param point - The new top-left corner point in local coordinate space.
   */
  setTopLeft(point: Point) {
    // Compute the parent-space position of the bottom-right corner before resizing
    const bottomRightBefore = this.toParentSpace(this.bottomRight);

    // Update x, y, width, and height
    const deltaWidth = this._width - point.x;
    const deltaHeight = this._height - point.y;

    this._x += point.x;
    this._y += point.y;
    this._width = deltaWidth;
    this._height = deltaHeight;

    // Update transformation matrices after changing size and position
    this.#updateMatrices();

    // Compute the parent-space position of the bottom-right corner after resizing
    const bottomRightAfter = this.toParentSpace(this.bottomRight);

    // Compute the difference in position
    const deltaX = bottomRightAfter.x - bottomRightBefore.x;
    const deltaY = bottomRightAfter.y - bottomRightBefore.y;

    // Adjust x and y to compensate for the movement
    this._x -= deltaX;
    this._y -= deltaY;

    // Update matrices again after adjusting position
    this.#updateMatrices();
  }

  /**
   * Sets the **top-right** corner of the rectangle in **local space**, adjusting the position, width, and height accordingly,
   * and keeps the **bottom-left corner** fixed in the **parent space**.
   * @param point - The new top-right corner point in local coordinate space.
   */
  setTopRight(point: Point) {
    // Compute the parent-space position of the bottom-left corner before resizing
    const bottomLeftBefore = this.toParentSpace(this.bottomLeft);

    // Update y, width, and height
    const deltaWidth = point.x;
    const deltaHeight = this._height - point.y;

    this._y += point.y;
    this._width = deltaWidth;
    this._height = deltaHeight;

    // Update transformation matrices after changing size and position
    this.#updateMatrices();

    // Compute the parent-space position of the bottom-left corner after resizing
    const bottomLeftAfter = this.toParentSpace(this.bottomLeft);

    // Compute the difference in position
    const deltaX = bottomLeftAfter.x - bottomLeftBefore.x;
    const deltaY = bottomLeftAfter.y - bottomLeftBefore.y;

    // Adjust x and y to compensate for the movement
    this._x -= deltaX;
    this._y -= deltaY;

    // Update matrices again after adjusting position
    this.#updateMatrices();
  }

  /**
   * Sets the **bottom-right** corner of the rectangle in **local space**, adjusting the width and height accordingly,
   * and keeps the **top-left corner** fixed in the **parent space**.
   * @param point - The new bottom-right corner point in local coordinate space.
   */
  setBottomRight(point: Point) {
    // Compute the parent-space position of the top-left corner before resizing
    const topLeftBefore = this.toParentSpace(this.topLeft);

    // Update width and height
    this._width = point.x;
    this._height = point.y;

    // Update transformation matrices after changing size
    this.#updateMatrices();

    // Compute the parent-space position of the top-left corner after resizing
    const topLeftAfter = this.toParentSpace(this.topLeft);

    // Compute the difference in position
    const deltaX = topLeftAfter.x - topLeftBefore.x;
    const deltaY = topLeftAfter.y - topLeftBefore.y;

    // Adjust x and y to compensate for the movement
    this._x -= deltaX;
    this._y -= deltaY;

    // Update matrices again after adjusting position
    this.#updateMatrices();
  }

  /**
   * Sets the **bottom-left** corner of the rectangle in **local space**, adjusting the position, width, and height accordingly,
   * and keeps the **top-right corner** fixed in the **parent space**.
   * @param point - The new bottom-left corner point in local coordinate space.
   */
  setBottomLeft(point: Point) {
    // Compute the parent-space position of the top-right corner before resizing
    const topRightBefore = this.toParentSpace(this.topRight);

    // Update x, width, and height
    const deltaWidth = this._width - point.x;
    const deltaHeight = point.y;

    this._x += point.x;
    this._width = deltaWidth;
    this._height = deltaHeight;

    // Update transformation matrices after changing size and position
    this.#updateMatrices();

    // Compute the parent-space position of the top-right corner after resizing
    const topRightAfter = this.toParentSpace(this.topRight);

    // Compute the difference in position
    const deltaX = topRightAfter.x - topRightBefore.x;
    const deltaY = topRightAfter.y - topRightBefore.y;

    // Adjust x and y to compensate for the movement
    this._x -= deltaX;
    this._y -= deltaY;

    // Update matrices again after adjusting position
    this.#updateMatrices();
  }

  /**
   * Computes the **axis-aligned bounding box** of the transformed rectangle in **parent space**.
   * @returns An object representing the bounding rectangle with properties: `x`, `y`, `width`, `height`.
   */
  getBounds(): DOMRectInit {
    // Transform all vertices to parent space
    const transformedVertices = this.vertices().map((v) => this.toParentSpace(v));

    // Find min and max coordinates
    const xs = transformedVertices.map((v) => v.x);
    const ys = transformedVertices.map((v) => v.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }
}

/**
 * A **read-only** version of `TransformDOMRect` that prevents modification of position,
 * size, and rotation properties.
 */
export class TransformDOMRectReadonly extends TransformDOMRect {
  constructor(init: TransformDOMRectInit = {}) {
    super(init);
  }

  // Explicit overrides for all getters from parent class
  override get x(): number {
    return super.x;
  }

  override get y(): number {
    return super.y;
  }

  override get width(): number {
    return super.width;
  }

  override get height(): number {
    return super.height;
  }

  override get rotation(): number {
    return super.rotation;
  }

  override get left(): number {
    return super.left;
  }

  override get top(): number {
    return super.top;
  }

  override get right(): number {
    return super.right;
  }

  override get bottom(): number {
    return super.bottom;
  }

  override get transformMatrix(): Matrix {
    return super.transformMatrix;
  }

  override get inverseMatrix(): Matrix {
    return super.inverseMatrix;
  }

  override get topLeft(): Point {
    return super.topLeft;
  }

  override get topRight(): Point {
    return super.topRight;
  }

  override get bottomRight(): Point {
    return super.bottomRight;
  }

  override get bottomLeft(): Point {
    return super.bottomLeft;
  }

  override get center(): Point {
    return super.center;
  }

  // Add no-op setters
  override set x(value: number) {
    // no-op
  }

  override set y(value: number) {
    // no-op
  }

  override set width(value: number) {
    // no-op
  }

  override set height(value: number) {
    // no-op
  }

  override set rotation(value: number) {
    // no-op
  }
}
