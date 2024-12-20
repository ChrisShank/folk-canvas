import { FolkElement } from '@lib';
import { html } from '@lib/tags';
import { Point } from '@lib/types';
import { css } from '@lit/reactive-element';

interface TransformRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class FolkSpace extends FolkElement {
  static override tagName = 'folk-space';

  static styles = css`
    :host {
      display: block;
      perspective: 1000px;
      position: relative;
      width: 100%;
      height: 100%;
    }

    .space {
      position: absolute;
      width: 100%;
      height: 100%;
      transform-style: preserve-3d;
      transform-origin: center;
    }

    .face {
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
    }
  `;

  #perspective = 1000;
  #isRotated = false;
  #transitionProgress = 0;

  // Create base matrices
  #frontMatrix = new DOMMatrix();
  #backMatrix = new DOMMatrix().rotateAxisAngle(1, 0, 0, 90);
  // Update matrices and DOM
  #updateTransforms() {
    const rotation = this.#isRotated ? -90 * this.#transitionProgress : -90 * (1 - this.#transitionProgress);

    const backRotation = this.#isRotated ? 90 * (1 - this.#transitionProgress) : 90 * this.#transitionProgress;

    // Update matrices
    this.#frontMatrix = new DOMMatrix().rotateAxisAngle(1, 0, 0, rotation);
    this.#backMatrix = new DOMMatrix().rotateAxisAngle(1, 0, 0, backRotation);

    // Update DOM
    const frontFace = this.shadowRoot?.querySelector('.front');
    const backFace = this.shadowRoot?.querySelector('.back');

    if (frontFace instanceof HTMLElement) {
      frontFace.style.transform = this.#frontMatrix.toString();
    }
    if (backFace instanceof HTMLElement) {
      backFace.style.transform = this.#backMatrix.toString();
    }
  }

  override createRenderRoot() {
    const root = super.createRenderRoot() as ShadowRoot;

    root.setHTMLUnsafe(html`
      <div class="space">
        <div class="face front" style="transform: ${this.#frontMatrix}">
          <slot name="front"></slot>
        </div>
        <div class="face back" style="transform: ${this.#backMatrix}">
          <slot name="back"></slot>
        </div>
      </div>
    `);

    return root;
  }

  localToScreen(point: Point, face: 'front' | 'back'): Point {
    const spaceRect = this.getBoundingClientRect();
    const centerX = spaceRect.width / 2;
    const centerY = spaceRect.height / 2;

    // Use the same matrix we're using for CSS
    const matrix = new DOMMatrix()
      .translate(centerX, centerY)
      .multiply(new DOMMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1 / this.#perspective, 0, 0, 0, 1]))
      .multiply(face === 'front' ? this.#frontMatrix : this.#backMatrix)
      .translate(-centerX, -centerY);

    const transformedPoint = matrix.transformPoint(new DOMPoint(point.x, point.y, 0, 1));

    const w = transformedPoint.w || 1;
    return {
      x: transformedPoint.x / w,
      y: transformedPoint.y / w,
    };
  }

  transition() {
    this.#isRotated = !this.#isRotated;
    this.#transitionProgress = 0;

    const startTime = performance.now();
    const duration = 600;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      this.#transitionProgress = Math.min(elapsed / duration, 1);

      this.#updateTransforms();

      if (this.#transitionProgress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Transforms a rect from an element in either face to screen coordinates
   */
  transformRect(rect: TransformRect, face: 'front' | 'back'): TransformRect {
    // Get center point
    const center = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };

    const transformedCenter = this.localToScreen(center, face);

    return {
      x: transformedCenter.x - rect.width / 2,
      y: transformedCenter.y - rect.height / 2,
      width: rect.width,
      height: rect.height,
    };
  }

  /**
   * Gets the screen coordinates for any element slotted into either face
   */
  getElementScreenRect(element: Element): TransformRect | null {
    // Find which slot the element belongs to
    const slot = element.closest('[slot]');
    if (!slot) return null;

    const face = slot.getAttribute('slot') as 'front' | 'back';
    if (face !== 'front' && face !== 'back') return null;

    // Get the element's transform
    if ('getTransformDOMRect' in element) {
      const rect = (element as any).getTransformDOMRect();
      return this.transformRect(rect, face);
    }

    return null;
  }
}
