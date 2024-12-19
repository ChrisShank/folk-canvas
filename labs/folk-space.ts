import { FolkElement } from '@lib';
import { DOMTransform } from '@lib/DOMTransform';
import { html } from '@lib/tags';
import { Point } from '@lib/types';
import { css } from '@lit/reactive-element';

declare global {
  interface HTMLElementTagNameMap {
    'folk-space': FolkSpace;
  }
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
      transition: transform 0.6s linear;
    }

    .back {
      transform: rotateX(90deg);
    }
  `;

  #frontMatrix = new DOMMatrix();
  #backMatrix = new DOMMatrix().rotate(90, 0, 0);
  #isRotated = false;
  #transitionProgress = 0;

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

    this.transition();

    return root;
  }

  localToScreen(point: Point, face: 'front' | 'back'): Point {
    const spaceRect = this.getBoundingClientRect();
    const centerX = spaceRect.width / 2;
    const centerY = spaceRect.height / 2;
    const perspective = 1000;

    let rotation = 0;
    if (face === 'front') {
      rotation = this.#isRotated ? -90 * this.#transitionProgress : -90 * (1 - this.#transitionProgress);
    } else {
      rotation = this.#isRotated ? 90 * (1 - this.#transitionProgress) : 90 * this.#transitionProgress;
    }

    // Create perspective matrix
    const matrix = new DOMMatrix()
      .translate(centerX, centerY)
      .multiply(new DOMMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1 / perspective, 0, 0, 0, 1]))
      .translate(-centerX, -centerY)
      .translate(centerX, centerY)
      .rotate(rotation, 0, 0)
      .translate(-centerX, -centerY);

    const transformedPoint = matrix.transformPoint(new DOMPoint(point.x, point.y, 0, 1));

    // Perform perspective division
    const w = transformedPoint.w || 1;
    return {
      x: transformedPoint.x / w,
      y: transformedPoint.y / w,
    };
  }

  transition() {
    this.#isRotated = !this.#isRotated;

    // Reset transition progress
    this.#transitionProgress = 0;

    // Track transition
    const startTime = performance.now();
    const duration = 600; // Match CSS transition duration (0.6s)

    const animate = () => {
      const elapsed = performance.now() - startTime;
      this.#transitionProgress = Math.min(elapsed / duration, 1);

      if (this.#transitionProgress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);

    // Update DOM
    const frontFace = this.shadowRoot?.querySelector('.front');
    const backFace = this.shadowRoot?.querySelector('.back');
    if (frontFace instanceof HTMLElement) {
      frontFace.style.transform = this.#isRotated ? 'rotateX(-90deg)' : 'rotateX(0deg)';
    }
    if (backFace instanceof HTMLElement) {
      backFace.style.transform = this.#isRotated ? 'rotateX(0deg)' : 'rotateX(90deg)';
    }
  }
}
